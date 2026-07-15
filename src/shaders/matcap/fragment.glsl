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

    if(vWorldPosition.z < 0.0)
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

    vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;

    // Custom start
    float indirectDistanceStrength = clamp(1.0 - vWorldPosition.z / uIndirectDistanceAmplitude, 0.0, 1.0) * uIndirectDistanceStrength;
    indirectDistanceStrength = pow(indirectDistanceStrength, uIndirectDistancePower);
    indirectDistanceStrength = clamp(indirectDistanceStrength, 0.0, 1.0);

    vec3 worldNormal = inverseTransformDirection(vNormal, viewMatrix);

    float indirectAngleStrength = dot(normalize(worldNormal), vec3(0.0, 0.0, - 1.0)) + uIndirectAngleOffset;
    indirectAngleStrength = clamp(indirectAngleStrength * uIndirectAngleStrength, 0.0, 1.0);
    indirectAngleStrength = pow(indirectAngleStrength, uIndirectAnglePower);

    // vec3 uIndirectColor = vec3(208.0 / 255.0, 69.0 / 255.0, 0.0 / 255.0);
    float indirectStrength = indirectDistanceStrength * indirectAngleStrength;
    // float indirectStrength = indirectAngleStrength;

    vec3 color = mix(outgoingLight, uIndirectColor, indirectStrength);

    // Day/night tint
    color *= uNightTint;

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

    gl_FragColor = vec4(color, diffuseColor.a);
    // Custom end

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}
