attribute float alpha;
attribute float size;
attribute vec3 color;

varying float vAlpha;
varying vec3 vColor;

uniform float uPixelRatio;

void main()
{
    vAlpha = alpha;
    vColor = color;

    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;

    gl_Position = projectionPosition;
    gl_PointSize = size * uPixelRatio * 100.0;
    gl_PointSize *= (1.0 / -viewPosition.z);
}
