#define TOTO
#define MATCAP
#define USE_MATCAP

uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;

varying vec3 vViewPosition;

// Custom start
uniform mat3 normalMatrix;
uniform float uIndirectDistanceAmplitude;
uniform float uIndirectDistanceStrength;
uniform float uIndirectDistancePower;
uniform float uIndirectAngleStrength;
uniform float uIndirectAngleOffset;
uniform float uIndirectAnglePower;
uniform vec3 uIndirectColor;

// Day/night tint (white during the day, dark blue at night)
uniform vec3 uNightTint;
uniform vec3 uCelColor;
uniform float uUseCelColor;
uniform float uAllowBelowGround;
uniform float uCelEmission;
uniform float uWetness;
uniform float uTime;
uniform vec3 uSunDirection;

// Fake spotlight (matcaps ignore real Three.js lights, so the cone falloff is computed here)
uniform vec3 uSpotPosition;
uniform vec3 uSpotDirection;
uniform vec3 uSpotColor;
uniform float uSpotIntensity;
uniform float uSpotAngleCos;
uniform float uSpotPenumbraCos;
uniform float uSpotDistance;

varying vec3 vWorldPosition;
// Custom end

#ifndef FLAT_SHADED

    varying vec3 vNormal;

#endif

#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>

#include <fog_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

    if(vWorldPosition.z < 0.0 && uAllowBelowGround < 0.5)
    {
        discard;
    }

    #include <clipping_planes_fragment>

    vec4 diffuseColor = vec4( diffuse, opacity );

    #include <logdepthbuf_fragment>
    #include <map_fragment>
    #include <alphamap_fragment>
    #include <alphatest_fragment>
    #include <normal_fragment_begin>
    #include <normal_fragment_maps>

    vec3 viewDir = normalize( vViewPosition );
    vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
    vec3 y = cross( viewDir, x );
    vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5; // 0.495 to remove artifacts caused by undersized matcap disks

    #ifdef USE_MATCAP

        vec4 matcapColor = texture2D( matcap, uv );
        // matcapColor = matcapTexelToLinear( matcapColor );

    #else

        vec4 matcapColor = vec4( 1.0 );

    #endif

    vec3 worldNormal = inverseTransformDirection(normal, viewMatrix);
    // Three deliberate lighting bands, cool bounce and a warm key. The same
    // inexpensive shader shades both the original props and Blender assets.
    float sun = dot(normalize(worldNormal), uSunDirection);
    float cel = 0.48 + step(-0.1, sun) * 0.23 + step(0.48, sun) * 0.29;
    vec3 baseColor = mix(floor(matcapColor.rgb * 5.0 + 0.5) / 5.0, uCelColor, uUseCelColor);
    vec3 outgoingLight = diffuseColor.rgb * baseColor * cel;

    // Custom start
    float indirectDistanceStrength = clamp(1.0 - vWorldPosition.z / uIndirectDistanceAmplitude, 0.0, 1.0) * uIndirectDistanceStrength;
    indirectDistanceStrength = pow(indirectDistanceStrength, uIndirectDistancePower);
    indirectDistanceStrength = clamp(indirectDistanceStrength, 0.0, 1.0);

    float indirectAngleStrength = dot(normalize(worldNormal), vec3(0.0, 0.0, - 1.0)) + uIndirectAngleOffset;
    indirectAngleStrength = clamp(indirectAngleStrength * uIndirectAngleStrength, 0.0, 1.0);
    indirectAngleStrength = pow(indirectAngleStrength, uIndirectAnglePower);

    // vec3 uIndirectColor = vec3(208.0 / 255.0, 69.0 / 255.0, 0.0 / 255.0);
    float indirectStrength = indirectDistanceStrength * indirectAngleStrength;
    // float indirectStrength = indirectAngleStrength;

    vec3 color = mix(outgoingLight, uIndirectColor, indirectStrength);

    // Day/night tint
    color *= uNightTint;
    float nightGlow = 1.0 - max(max(uNightTint.r, uNightTint.g), uNightTint.b);
    color += uCelColor * uCelEmission * clamp(nightGlow, 0.0, 1.0);
    float rim = smoothstep(0.64, 0.88, 1.0 - max(dot(normal, viewDir), 0.0));
    color += baseColor * vec3(0.35, 0.65, 0.85) * rim * 0.2;
    float glint = step(0.965, dot(reflect(-normalize((viewMatrix * vec4(uSunDirection, 0.0)).xyz), normal), viewDir));
    color += vec3(1.0, 0.78, 0.48) * glint * 0.16 * uNightTint;
    color *= mix(0.7, 1.0, smoothstep(0.0, 0.22, abs(dot(normal, viewDir))));

    // Fake spotlight: distance + cone + lambert-ish falloff in world space
    if(uSpotIntensity > 0.001)
    {
        vec3 toFragment = vWorldPosition - uSpotPosition;
        float spotFragmentDistance = length(toFragment);
        vec3 spotRayDirection = toFragment / max(spotFragmentDistance, 0.0001);

        float coneCos = dot(spotRayDirection, uSpotDirection);
        float coneFalloff = smoothstep(uSpotAngleCos, uSpotPenumbraCos, coneCos);

        float distanceFalloff = clamp(1.0 - spotFragmentDistance / uSpotDistance, 0.0, 1.0);
        distanceFalloff *= distanceFalloff;

        float diffuseTerm = max(dot(normalize(worldNormal), - spotRayDirection), 0.0) * 0.7 + 0.3;

        color += outgoingLight * uSpotColor * (uSpotIntensity * coneFalloff * distanceFalloff * diffuseTerm);
    }

    if(uAllowBelowGround > 0.5)
    {
        vec2 p = vWorldPosition.xy;
        // World-anchored asphalt seams, aggregate and rain-slick neon reflections.
        float grain = fract(sin(dot(floor(p * 36.0), vec2(12.9898,78.233))) * 43758.5453);
        color *= 0.94 + grain * 0.06;
        vec2 seam = abs(fract(p / 6.0) - 0.5);
        float line = smoothstep(0.488, 0.498, max(seam.x, seam.y));
        color = mix(color, vec3(0.018,0.033,0.055), line * 0.3);
        float puddle = smoothstep(0.15, 0.7, sin(p.x * 0.63) * sin(p.y * 0.49));
        float ripple = sin(length(fract(p / 2.0) - 0.5) * 36.0 - uTime * 5.0) * 0.5 + 0.5;
        vec3 reflectedNeon = mix(vec3(0.01,0.24,0.3), vec3(0.25,0.025,0.18), sin(p.x * 0.12) * 0.5 + 0.5);
        color = mix(color, color * 0.65 + reflectedNeon * (0.38 + ripple * 0.06), uWetness * puddle);
    }
    outgoingLight = color;
    // Custom end

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}
