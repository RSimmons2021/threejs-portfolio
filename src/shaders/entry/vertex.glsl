attribute vec3 aColor;
attribute float aActive;
varying vec2 vUv;
varying vec3 vColor;
varying float vActive;
void main()
{
    vUv = uv; vColor = aColor; vActive = aActive;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
