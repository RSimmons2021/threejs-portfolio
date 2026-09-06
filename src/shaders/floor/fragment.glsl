uniform sampler2D tBackground;
uniform float uWetness;
uniform float uTime;
uniform vec3 uCameraPosition;
uniform mat4 uInverseViewProjection;
uniform vec2 uSpotPosition;
uniform vec3 uSpotColor;
uniform float uSpotIntensity;
uniform float uSpotRadius;
varying vec2 vUv;

void main()
{
    vec4 farPoint = uInverseViewProjection * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 ray = normalize(farPoint.xyz / farPoint.w - uCameraPosition);
    vec3 color = vec3(0.018, 0.025, 0.055);
    if(ray.z < -0.0001)
    {
        vec2 p = uCameraPosition.xy + ray.xy * (-uCameraPosition.z / ray.z);
        vec2 tile = floor(p / 3.0);
        float hash = fract(sin(dot(tile, vec2(127.1,311.7))) * 43758.5453);
        vec2 edge = abs(fract(p / 3.0) - 0.5);
        vec2 aa = max(fwidth(p / 3.0), vec2(0.001));
        float seam = max(smoothstep(0.491-aa.x,0.5,edge.x),smoothstep(0.491-aa.y,0.5,edge.y));
        color = mix(vec3(0.022,0.035,0.061),vec3(0.038,0.044,0.074),hash);
        color *= 1.0 - seam * 0.65;
        // Embedded cyan and magenta service channels break up the dark city pavers.
        vec2 district = abs(fract((p + 1.5) / 24.0) - 0.5);
        float channelX = smoothstep(0.495-max(fwidth(p.x/24.0),0.0005),0.499,district.x);
        float channelY = smoothstep(0.495-max(fwidth(p.y/24.0),0.0005),0.499,district.y);
        color += vec3(0.015,0.2,0.24) * channelX * 0.55;
        color += vec3(0.21,0.022,0.16) * channelY * 0.45;
        // Occasional inset service panels and small amber corner markers.
        float panel = step(0.75,hash) * step(edge.x,0.3) * step(edge.y,0.3);
        color *= 1.0 - panel * 0.22;
        float marker = step(0.87,hash) * step(0.34,edge.x) * step(edge.x,0.4) * step(edge.y,0.07);
        color += vec3(0.34,0.19,0.045) * marker;
        float puddle = smoothstep(0.05,0.65,sin(p.x*0.39)*sin(p.y*0.51));
        float time = uTime * 0.001;
        float ripple = sin(length(fract(p/2.0)-0.5)*38.0-time*5.0)*0.5+0.5;
        vec3 reflection = mix(vec3(0.015,0.16,0.2),vec3(0.17,0.02,0.14),sin(p.x*.15)*.5+.5);
        color = mix(color,color*.65+reflection*(.35+ripple*.06),puddle*uWetness);
        float pool = 1.0 - smoothstep(uSpotRadius * 0.2,uSpotRadius,length(p-uSpotPosition));
        color += uSpotColor * uSpotIntensity * pool * pool;
        // Subtle time-of-day influence; the paving stays spatial rather than a gradient.
        color *= 0.75 + dot(texture2D(tBackground,vec2(0.5)).rgb,vec3(0.2126,0.7152,0.0722)) * 0.5;
    }
    gl_FragColor = vec4(color,1.0);
}
