import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

// Google-ish primary palette
const COLORS = {
  blue: "#4285F4",   // Skill
  red: "#DB4437",    // Love
  green: "#0F9D58",  // Need
  yellow: "#F4B400", // Pay
};

// Map vertices to primaries
const VERTEX_COLOR = {
  Love: COLORS.red,
  Skill: COLORS.blue,
  Need: COLORS.green,
  Pay: COLORS.yellow,
};

// Color utilities
function hexToRgb(hex) {
  const n = hex.replace('#','');
  const bigint = parseInt(n, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function rgbToHex({r,g,b}) {
  const to = (v)=>('0'+Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
  return `#${to(r)}${to(g)}${to(b)}`;
}
// Additive mixing (sum channels, then normalize to avoid washout)
function mixAdditive(hexes) {
  const sum = hexes.map(hexToRgb).reduce((a,c)=>({r:a.r+c.r,g:a.g+c.g,b:a.b+c.b}),{r:0,g:0,b:0});
  const maxCh = Math.max(sum.r, sum.g, sum.b, 1);
  const scale = maxCh > 255 ? 255 / maxCh : 1; // keep brightest channel at 255
  return rgbToHex({ r: sum.r * scale, g: sum.g * scale, b: sum.b * scale });
}

// Helper to create a styled HTML label for CSS2DObject
function makeLabel(text) {
  const div = document.createElement("div");
  div.textContent = text;
  div.style.padding = "0"; // minimal, no background chip
  div.style.borderRadius = "0";
  div.style.background = "transparent";
  div.style.color = "#222";
  div.style.fontSize = "13px";
  div.style.fontWeight = "600";
  div.style.whiteSpace = "nowrap";
  div.style.pointerEvents = "none"; // let pointer pass through
  return new CSS2DObject(div);
}

export default function IkigaiTetrahedron() {
  const containerRef = useRef(null);
  const [focus, setFocus] = useState({ title: "Explore the Shape", body: "Hover/tap elements or click vertices to build overlaps. Edges = two-way, Faces = three-way; the center is Ikigai (all four)." });
  const [selection, setSelection] = useState([]); // array of vertex indices

  useEffect(() => {
    const container = containerRef.current;

    // Scene, camera, renderers
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // WHITE background

    const camera = new THREE.PerspectiveCamera(
      68, // dramatic perspective for depth
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(4.2, 3.5, 4.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.pointerEvents = "none"; // labels don't block hover
    container.appendChild(labelRenderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.55;

    // Lights (brighter, directional shadows for depth)
    const hemi = new THREE.HemisphereLight(0xffffff, 0xdddddd, 1.0);
    hemi.position.set(0, 1, 0);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(6, 8, 7);
    scene.add(dir);

    // Subtle ground plane for bearings
    const grid = new THREE.GridHelper(10, 10, 0xdddddd, 0xeeeeee);
    grid.position.y = -1.6;
    scene.add(grid);

    // Tetrahedron vertices (regular, centered at origin)
    const v = [
      new THREE.Vector3(1, 1, 1),   // 0 Love
      new THREE.Vector3(1, -1, -1), // 1 Skill
      new THREE.Vector3(-1, 1, -1), // 2 Need
      new THREE.Vector3(-1, -1, 1), // 3 Pay
    ];

    const vertexLabels = ["Love", "Skill", "Need", "Pay"];

    const vertexDescriptions = {
      Love: "Enjoyment & intrinsic motivation — you’d choose to do this even if no one asked. It energizes you.",
      Skill: "Competence & reliability — you can produce quality results safely and consistently.",
      Need: "Real usefulness — the work solves a clear problem and makes life easier for others.",
      Pay: "Market signal — someone benefits enough to exchange money for the result.",
    };

    // === UPDATED EDGE & FACE LABELS/DEFS PER YOUR LIST ===
    // Edge (two-vertex) definitions
    const edgePairs = [[0,1],[0,3],[0,2],[1,3],[1,2],[2,3]]; // order matches names below
    const edgeNames = {
      "0,1": "Passion (Love + Good at)",
      "0,3": "Pipe Dream (Love + Paid)",
      "0,2": "Good Intentions (Love + World Needs)",
      "1,3": "Profession (Good at + Paid)",
      "1,2": "Calling (Good at + World Needs)",
      "2,3": "Vocation (World Needs + Paid)",
    };
    const edgeDescriptions = {
      "Passion (Love + Good at)": "You love it and you’re good at it — but there’s no pay and the world may not need it.",
      "Pipe Dream (Love + Paid)": "People might pay, but you’re not good at it and the world doesn’t need it — risky or unsustainable.",
      "Good Intentions (Love + World Needs)": "You care and it’s needed — but you’re not yet good at it and there’s no pay.",
      "Profession (Good at + Paid)": "A solid profession — but you don’t love it and the world may not need more of it.",
      "Calling (Good at + World Needs)": "Your ability meets a real need — but there’s no pay and you don’t love it.",
      "Vocation (World Needs + Paid)": "Clear demand with pay — but you don’t love it and aren’t good at it yet.",
    };

    // Face (three-vertex) definitions
    const faceTriples = [
      [0,1,2], // Love + Good at + World Needs
      [0,1,3], // Love + Good at + Paid
      [0,2,3], // Love + World Needs + Paid
      [1,2,3], // Good at + World Needs + Paid
    ];
    const faceNames = [
      "Volunteering (Love + Good at + World Needs)",
      "Dream Job (Love + Good at + Paid)",
      "Education Opportunity (Love + Paid + World Needs)",
      "Job (Good at + Paid + World Needs)",
    ];
    const faceDescriptions = {
      "Dream Job (Love + Good at + Paid)": "Feels amazing and is rewarded — but if the world doesn’t need it, it can feel useless.",
      "Volunteering (Love + Good at + World Needs)": "Deeply meaningful service — but with no pay it can lead to financial struggle.",
      "Education Opportunity (Love + Paid + World Needs)": "There’s real need and pay and you care — focus your learning to build skill.",
      "Job (Good at + Paid + World Needs)": "Useful and sustainable — but without love it can feel empty over time.",
    };

    // Groups & maps
    const faceGroup = new THREE.Group();
    const facePickGroup = new THREE.Group();
    const faceMeshByKey = new Map();

    const edgeGroup = new THREE.Group();
    const edgePickGroup = new THREE.Group();
    const edgeMeshByKey = new Map();

    const vertexGroup = new THREE.Group();
    const vertexPickGroup = new THREE.Group();

    // Build faces with bright additive-mixed colors
    faceTriples.forEach((tri, i) => {
      const positions = new Float32Array([
        v[tri[0]].x, v[tri[0]].y, v[tri[0]].z,
        v[tri[1]].x, v[tri[1]].y, v[tri[1]].z,
        v[tri[2]].x, v[tri[2]].y, v[tri[2]].z,
      ]);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geom.computeVertexNormals();

      const color = mixAdditive([
        VERTEX_COLOR[vertexLabels[tri[0]]],
        VERTEX_COLOR[vertexLabels[tri[1]]],
        VERTEX_COLOR[vertexLabels[tri[2]]],
      ]);

      const mat = new THREE.MeshPhongMaterial({
        color,
        opacity: 0.5,
        transparent: true,
        side: THREE.DoubleSide,
        shininess: 90,
      });

      const mesh = new THREE.Mesh(geom, mat);
      const key = tri.slice().sort().join(',');
      mesh.userData = { type: "face", key, name: faceNames[i], tri };
      faceGroup.add(mesh);
      faceMeshByKey.set(key, mesh);

      const pick = new THREE.Mesh(geom.clone(), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
      pick.userData = { type: "face", key, name: faceNames[i], tri };
      facePickGroup.add(pick);
    });
    scene.add(faceGroup);
    scene.add(facePickGroup);

    // Build colored edges (visible cylinders) + pick cyl (same)
    function addEdge(a,b){
      const start = v[a];
      const end = v[b];
      const dir = new THREE.Vector3().subVectors(end, start);
      const length = dir.length();
      const radius = 0.07; // slightly thinner base

      const color = mixAdditive([
        VERTEX_COLOR[vertexLabels[a]],
        VERTEX_COLOR[vertexLabels[b]]
      ]);

      const cylGeom = new THREE.CylinderGeometry(radius, radius, length, 28, 1, true);
      const mat = new THREE.MeshPhongMaterial({ color, shininess: 110 });
      const cylinder = new THREE.Mesh(cylGeom, mat);
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      cylinder.position.copy(midpoint);
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
      const key = [a,b].sort().join(',');
      cylinder.userData = { type: "edge", key, name: edgeNames[key], pair: [a,b] };
      edgeGroup.add(cylinder);
      edgeMeshByKey.set(key, cylinder);

      const pick = new THREE.Mesh(cylGeom.clone(), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.copy(midpoint);
      pick.quaternion.copy(cylinder.quaternion);
      pick.userData = { type: "edge", key, name: edgeNames[key], pair: [a,b] };
      edgePickGroup.add(pick);
    }
    edgePairs.forEach(([a,b])=>addEdge(a,b));
    scene.add(edgeGroup);
    scene.add(edgePickGroup);

    // Vertex spheres (primary colors) + labels farther + pick spheres
    const vertexObjects = [];
    v.forEach((pt, idx) => {
      const color = VERTEX_COLOR[vertexLabels[idx]];
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 24, 24),
        new THREE.MeshPhysicalMaterial({ color, metalness: 0.2, roughness: 0.25 })
      );
      sphere.position.copy(pt);
      sphere.userData = { type: "vertex", idx, name: vertexLabels[idx] };
      vertexGroup.add(sphere);
      vertexObjects.push(sphere);

      const label = makeLabel(vertexLabels[idx]);
      label.position.copy(pt.clone().multiplyScalar(1.3)); // farther from vertex
      scene.add(label);

      const pick = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.copy(pt);
      pick.userData = { type: "vertex", idx, name: vertexLabels[idx] };
      vertexPickGroup.add(pick);
    });
    scene.add(vertexGroup);
    scene.add(vertexPickGroup);

    // Frosted center sphere for depth cue
    const frost = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 32, 32),
      new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })
    );
    scene.add(frost);

    // Center marker for Ikigai
    const ikigai = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.16),
      new THREE.MeshStandardMaterial({ color: 0x00a86b, emissive: 0x008855 })
    );
    scene.add(ikigai);

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function setPointer(evt) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
    }

    // Compute keys
    const edgeKeyFrom = (a,b)=>[a,b].sort().join(',');
    const faceKeyFrom = (a,b,c)=>[a,b,c].sort().join(',');

    // Highlight helpers
    function resetHighlights(){
      faceGroup.children.forEach(m=>{ m.material.opacity = 0.5; });
      edgeGroup.children.forEach(m=>{ m.scale.set(1,1,1); });
      vertexGroup.children.forEach((s)=>{ s.scale.set(1,1,1); });
    }
    function brightenFace(key){
      const mesh = faceMeshByKey.get(key);
      if(!mesh) return;
      mesh.material.opacity = 0.8;
    }
    function thickenEdge(key){
      const mesh = edgeMeshByKey.get(key);
      if(!mesh) return;
      mesh.scale.set(1.5,1,1.5); // thinner than previous fat highlight
    }
    function popVertex(idx){
      const s = vertexGroup.children[idx];
      if (!s) return;
      s.scale.set(1.35,1.35,1.35);
    }

    // Selection state inside effect
    const selected = new Set();

    function updateFocusFromSelection(){
      const arr = Array.from(selected);
      if (arr.length === 0){
        setFocus({ title: "Explore the Shape", body: "Hover/tap elements or click vertices to build overlaps. Edges = two-way, Faces = three-way; the center is Ikigai (all four)." });
        return;
      }
      if (arr.length === 1){
        const i = arr[0];
        const name = vertexLabels[i];
        setFocus({ title: name, body: vertexDescriptions[name] });
        return;
      }
      if (arr.length === 2){
        const key = edgeKeyFrom(arr[0], arr[1]);
        const name = edgeNames[key];
        setFocus({ title: name, body: edgeDescriptions[name] });
        return;
      }
      if (arr.length === 3){
        const key = faceKeyFrom(arr[0], arr[1], arr[2]);
        const name = faceGroup.children.find(m=>m.userData.key===key)?.userData?.name;
        if (name) setFocus({ title: name, body: faceDescriptions[name] });
        return;
      }
      setFocus({ title: "Ikigai (All Yes)", body: "Balanced overlap of Love, Skill, Need, and Pay. This is the target zone where work feels meaningful, useful, capable, and rewarded." });
    }

    function setSelectionFromArray(arr){
      selected.clear();
      arr.forEach(i=>selected.add(i));
      resetHighlights();
      arr.forEach(i=>popVertex(i));
      if (arr.length === 2){
        thickenEdge(edgeKeyFrom(arr[0], arr[1]));
      } else if (arr.length === 3){
        brightenFace(faceKeyFrom(arr[0], arr[1], arr[2]));
      }
      updateFocusFromSelection();
      Promise.resolve().then(()=> setSelection(Array.from(selected)));
    }

    // Hover logic: only active when nothing is selected
    function onPointerMove(evt){
      setPointer(evt);
      raycaster.setFromCamera(pointer, camera);

      if (selected.size > 0){
        updateFocusFromSelection();
        return; // don't override selection with hover
      }

      // faces first
      const faceHits = raycaster.intersectObjects(facePickGroup.children, false);
      if (faceHits.length){
        const hit = faceHits[0].object;
        const name = hit.userData.name;
        setFocus({ title: name, body: faceDescriptions[name] });
        return;
      }
      const edgeHits = raycaster.intersectObjects(edgePickGroup.children, false);
      if (edgeHits.length){
        const hit = edgeHits[0].object;
        const name = hit.userData.name;
        setFocus({ title: name, body: edgeDescriptions[name] });
        return;
      }
      const vertexHits = raycaster.intersectObjects(vertexPickGroup.children, false);
      if (vertexHits.length){
        const hit = vertexHits[0].object;
        const name = hit.userData.name;
        setFocus({ title: name, body: vertexDescriptions[name] });
        return;
      }
      setFocus({ title: "Explore the Shape", body: "Hover/tap elements or click vertices to build overlaps. Edges = two-way, Faces = three-way; the center is Ikigai (all four)." });
    }

    // Click selection: vertex OR toggle edge/face on/off
    function arraysEqualAsSets(a, b){
      if (a.length !== b.length) return false;
      const sa = new Set(a), sb = new Set(b);
      for (const x of sa) if (!sb.has(x)) return false;
      return true;
    }

    function onPointerDown(evt){
      setPointer(evt);
      raycaster.setFromCamera(pointer, camera);

      // Try vertex first
      const vHits = raycaster.intersectObjects(vertexPickGroup.children, false);
      if (vHits.length){
        const idx = vHits[0].object.userData.idx;
        const arr = Array.from(selected);
        if (selected.has(idx)) {
          // deselect this one
          const next = arr.filter(i=>i!==idx);
          setSelectionFromArray(next);
        } else {
          if (arr.length < 4) setSelectionFromArray([...arr, idx]);
        }
        return;
      }

      // Then faces (toggle tri)
      const faceHits = raycaster.intersectObjects(facePickGroup.children, false);
      if (faceHits.length){
        const tri = faceHits[0].object.userData.tri;
        const current = Array.from(selected);
        if (arraysEqualAsSets(current, tri)) {
          setSelectionFromArray([]); // toggle off
        } else {
          setSelectionFromArray(tri);
        }
        return;
      }

      // Then edges (toggle pair)
      const edgeHits = raycaster.intersectObjects(edgePickGroup.children, false);
      if (edgeHits.length){
        const pair = edgeHits[0].object.userData.pair;
        const current = Array.from(selected);
        if (arraysEqualAsSets(current, pair)) {
          setSelectionFromArray([]); // toggle off
        } else {
          setSelectionFromArray(pair);
        }
        return;
      }
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Handle resize
    function onResize() {
      const { clientWidth, clientHeight } = container;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
      labelRenderer.setSize(clientWidth, clientHeight);
    }
    window.addEventListener("resize", onResize);

    // Animation loop
    function animate(){
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    // Cleanup on unmount
    return () => {
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
    };
  }, []);

  // Helper to show current selection as labels
  const idxToName = (i)=>["Love","Skill","Need","Pay"][i];

  return (
    <div className="w-full">
      {/* Canvas */}
      <div className="w-full h-[70vh] relative rounded-2xl overflow-hidden shadow-xl bg-white border" ref={containerRef} />

      {/* Below-canvas explanatory content */}
      <div className="mt-4 grid gap-4">
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-lg font-semibold mb-1">{focus.title}</div>
          <p className="text-sm leading-relaxed whitespace-pre-line">{focus.body}</p>
          {selection.length>0 && (
            <div className="text-xs mt-2 opacity-70">Selected vertices: {selection.map(idxToName).join(', ')}</div>
          )}
        </div>

        <div className="rounded-xl border p-4 bg-white">
          <div className="font-semibold">How to Explore</div>
          <ul className="list-disc ml-5 text-sm mt-1">
            <li>Rotate and zoom the tetrahedron to see which edges/faces are in front. A subtle frosted sphere in the middle helps depth perception.</li>
            <li>Hover any <b>edge</b> (two-way overlap) or <b>face</b> (three-way overlap) for definitions below. When vertices are selected, hover hints pause so your selection description stays visible.</li>
            <li>Click vertices to build combinations: one vertex → its meaning; two → the connecting edge; three → the full face; four → <b>Ikigai</b>.</li>
            <li>Colors are Google‑ish: <b>Love = Red</b>, <b>Skill = Blue</b>, <b>Need = Green</b>, <b>Pay = Yellow</b>. Edges/faces use the <i>additive mix</i> of their vertices (bright, not muddy).</li>
          </ul>
        </div>

        <div className="rounded-xl border p-4 bg-white">
          <div className="font-semibold mb-2">Glossary</div>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="font-medium">Edges (Two‑way overlaps)</div>
              <ul className="list-disc ml-5">
                <li><b>Passion</b> (Love + Good at): You love it and you’re good at it — but there’s no pay and the world may not need it.</li>
                <li><b>Pipe Dream</b> (Love + Paid): Paid but not skilled and not needed — risky or unsustainable.</li>
                <li><b>Good Intentions</b> (Love + World Needs): You care and it’s needed — but you’re not yet good at it and there’s no pay.</li>
                <li><b>Profession</b> (Good at + Paid): Solid profession — but you don’t love it and the world may not need more of it.</li>
                <li><b>Calling</b> (Good at + World Needs): Ability meets need — but no pay and you don’t love it.</li>
                <li><b>Vocation</b> (World Needs + Paid): Clear demand with pay — but you don’t love it and aren’t good at it yet.</li>
              </ul>
            </div>
            <div>
              <div className="font-medium">Faces (Three‑way overlaps)</div>
              <ul className="list-disc ml-5">
                <li><b>Dream Job</b> (Love + Good at + Paid): Feels amazing and rewarded — but if the world doesn’t need it, it can feel useless.</li>
                <li><b>Volunteering</b> (Love + Good at + World Needs): Deeply meaningful — but with no pay it can lead to financial struggle.</li>
                <li><b>Education Opportunity</b> (Love + Paid + World Needs): There’s need and pay and you care — focus your learning to build skill.</li>
                <li><b>Job</b> (Good at + Paid + World Needs): Useful and sustainable — but without love it can feel empty over time.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
