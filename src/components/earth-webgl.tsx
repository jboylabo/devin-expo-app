import { Asset } from 'expo-asset';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef } from 'react';
import type { ViewStyle } from 'react-native';

type EarthWebGLProps = {
  style?: ViewStyle;
};

const vertexShaderSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
  vNormal = mat3(uModelMatrix) * aNormal;
  vUV = aUV;
  vWorldPosition = worldPosition.xyz;
  gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform sampler2D uTexture;

varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vWorldPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDirection = normalize(vec3(-0.55, 0.32, 0.76));
  float diffuse = max(dot(normal, lightDirection), 0.0);
  vec3 viewDirection = normalize(vec3(0.0, 0.0, 3.0) - vWorldPosition);
  float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.4);

  vec3 textureColor = texture2D(uTexture, vUV).rgb;
  vec3 litColor = textureColor * (0.3 + diffuse * 0.78);
  vec3 atmosphere = vec3(0.22, 0.52, 1.0) * rim * 0.42;

  gl_FragColor = vec4(litColor + atmosphere, 1.0);
}
`;

function createSphere(widthSegments = 72, heightSegments = 40) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= heightSegments; y += 1) {
    const v = y / heightSegments;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let x = 0; x <= widthSegments; x += 1) {
      const u = x / widthSegments;
      const phi = u * Math.PI * 2;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const normalX = -cosPhi * sinTheta;
      const normalY = cosTheta;
      const normalZ = sinPhi * sinTheta;

      positions.push(normalX, normalY, normalZ);
      normals.push(normalX, normalY, normalZ);
      uvs.push(1 - u, 1 - v);
    }
  }

  for (let y = 0; y < heightSegments; y += 1) {
    for (let x = 0; x < widthSegments; x += 1) {
      const first = y * (widthSegments + 1) + x;
      const second = first + widthSegments + 1;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function perspective(fovY: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovY / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function lookAt(eye: [number, number, number], center: [number, number, number]) {
  const zAxis = normalize3([
    eye[0] - center[0],
    eye[1] - center[1],
    eye[2] - center[2],
  ]);
  const xAxis = normalize3(cross3([0, 1, 0], zAxis));
  const yAxis = cross3(zAxis, xAxis);

  return new Float32Array([
    xAxis[0],
    yAxis[0],
    zAxis[0],
    0,
    xAxis[1],
    yAxis[1],
    zAxis[1],
    0,
    xAxis[2],
    yAxis[2],
    zAxis[2],
    0,
    -dot3(xAxis, eye),
    -dot3(yAxis, eye),
    -dot3(zAxis, eye),
    1,
  ]);
}

function normalize3(vector: [number, number, number]) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  return [vector[0] / length, vector[1] / length, vector[2] / length] as [
    number,
    number,
    number,
  ];
}

function cross3(a: [number, number, number], b: [number, number, number]) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ] as [number, number, number];
}

function dot3(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function rotateX(angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function rotateY(angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }

  return out;
}

function compileShader(gl: ExpoWebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('WebGL shader could not be created');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl: ExpoWebGLRenderingContext) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();

  if (!program) {
    throw new Error('WebGL program could not be created');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown program link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function createBuffer(gl: ExpoWebGLRenderingContext, data: ArrayBufferView, target: number) {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error('WebGL buffer could not be created');
  }
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buffer;
}

async function startRenderer(gl: ExpoWebGLRenderingContext, isActive: () => boolean) {
  const earthAsset = Asset.fromModule(require('@/assets/textures/earth.jpg'));
  await earthAsset.downloadAsync();

  if (!isActive()) {
    return;
  }

  const sphere = createSphere();
  const program = createProgram(gl);
  gl.useProgram(program);

  createBuffer(gl, sphere.positions, gl.ARRAY_BUFFER);
  const positionLocation = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

  createBuffer(gl, sphere.normals, gl.ARRAY_BUFFER);
  const normalLocation = gl.getAttribLocation(program, 'aNormal');
  gl.enableVertexAttribArray(normalLocation);
  gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);

  createBuffer(gl, sphere.uvs, gl.ARRAY_BUFFER);
  const uvLocation = gl.getAttribLocation(program, 'aUV');
  gl.enableVertexAttribArray(uvLocation);
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

  createBuffer(gl, sphere.indices, gl.ELEMENT_ARRAY_BUFFER);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    earthAsset as unknown as TexImageSource
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);

  const projectionLocation = gl.getUniformLocation(program, 'uProjectionMatrix');
  const viewLocation = gl.getUniformLocation(program, 'uViewMatrix');
  const modelLocation = gl.getUniformLocation(program, 'uModelMatrix');
  const textureLocation = gl.getUniformLocation(program, 'uTexture');

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0.005, 0.012, 0.032, 1);

  const viewMatrix = lookAt([0, 0, 3], [0, 0, 0]);
  const tiltMatrix = rotateX(-0.32);
  const startedAt = Date.now();

  const render = () => {
    if (!isActive()) {
      return;
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const projectionMatrix = perspective(Math.PI / 4.6, width / height, 0.1, 100);
    const rotation = ((Date.now() - startedAt) / 1000) * 0.48;
    const modelMatrix = multiply(rotateY(rotation), tiltMatrix);

    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
    gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
    gl.uniformMatrix4fv(modelLocation, false, modelMatrix);
    gl.uniform1i(textureLocation, 0);
    gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);
    gl.flush();
    gl.endFrameEXP();

    requestAnimationFrame(render);
  };

  render();
}

export function EarthWebGL({ style }: EarthWebGLProps) {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <GLView
      style={style}
      msaaSamples={4}
      onContextCreate={(gl) => {
        startRenderer(gl, () => isMounted.current).catch((error: unknown) => {
          console.error('Earth renderer failed to start', error);
        });
      }}
    />
  );
}
