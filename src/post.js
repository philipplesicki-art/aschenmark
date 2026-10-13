// Nachbearbeitung: Bloom für Feuer und Fenster, Farbkorrektur (kalte Schatten, warme Lichter), Vignette, feines Korn.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

// Umgebungsverdeckung: dunkelt Ecken, Fugen und den Boden unter Figuren ab. Rauch, Funken, Schnee, Lichtflecken
// und der Kriegsnebel dürfen dabei nicht als Körper zählen, sonst entstehen dunkle Schleier.
class AOPass extends GTAOPass {
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse(o => {
      cache.set(o, o.visible);
      const m = o.material;
      if (o.isPoints || o.isLine || o.isSprite || (m && (m.transparent || m.depthTest === false || m.depthWrite === false))) o.visible = false;
    });
  }
  setSize(w, h) { super.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); } // halbe Auflösung reicht, der Filter glättet
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: .55 }, uGrain: { value: .035 }, uSharp: { value: .35 }, uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 760) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uSharp; uniform vec2 uTexel; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // Schärfen (Unscharfmaske mit vier Nachbarn)
      vec3 b = (texture2D(tDiffuse, vUv+vec2(uTexel.x,0.)).rgb + texture2D(tDiffuse, vUv-vec2(uTexel.x,0.)).rgb + texture2D(tDiffuse, vUv+vec2(0.,uTexel.y)).rgb + texture2D(tDiffuse, vUv-vec2(0.,uTexel.y)).rgb) * .25;
      c += (c - b) * uSharp;
      // Teilung der Töne: Schatten kalt, Lichter warm, mehr Kontrast, etwas weniger Farbe
      float l = dot(c, vec3(.299,.587,.114));
      c = mix(vec3(l), c, mix(.78, 1.08, smoothstep(.25, .75, l)));
      c = (c - .5) * 1.1 + .5;
      c += vec3(-.02,.002,.03) * (1. - smoothstep(0., .45, l));
      c += vec3(.045,.018,-.03) * smoothstep(.5, 1., l);
      // Vignette und Korn
      vec2 d = vUv - .5; float v = 1. - uVig * smoothstep(.25, .85, dot(d,d)*2.2);
      c *= v;
      c += (h(vUv * 900. + fract(uTime)) - .5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }`
};

export function makePost(renderer, scene, camera, w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new AOPass(scene, camera, w, h, undefined,
    { radius: 1.1, distanceExponent: 1.6, thickness: 2.2, scale: 1.25, samples: 16, distanceFallOff: 1, screenSpaceRadius: false },
    { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
  ao.blendIntensity = .95; composer.addPass(ao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), .5, .55, .82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);
  return {
    composer, bloom, grade, ao,
    setAO(on) { ao.enabled = !!on; },
    setSize(w, h, dpr) {
      composer.setPixelRatio(dpr); composer.setSize(w, h);
      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      grade.uniforms.uTexel.value.set(1 / s.x, 1 / s.y);
    },
    render(dt, t) { grade.uniforms.uTime.value = t; composer.render(dt); }
  };
}
