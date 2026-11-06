import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment, Html } from '@react-three/drei'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import type { PinResult } from '../types'

function UnoBoard({ pins, selected, onSelect }: { pins: PinResult[]; selected: string; onSelect: (p: string) => void }) {
  const pinMap = useMemo(() => new Map(pins.map(p => [p.pin, p.status])), [pins])
  const pinColor = (name: string) => {
    const s = pinMap.get(name)
    if (s === 'passed') return '#39d98a'
    if (s === 'failed') return '#ff5263'
    if (s === 'active') return '#49a6ff'
    return '#d5a84e'
  }
  const headers = [
    ...Array.from({ length: 14 }, (_, i) => ({ name: `D${i}`, x: -2.65 + i * .39, z: .72 })),
    ...Array.from({ length: 6 }, (_, i) => ({ name: `A${i}`, x: 1.65 - i * .39, z: -.72 }))
  ]
  return <group>
    {/* PCB */}
    <mesh receiveShadow castShadow position={[0, 0, 0]}><boxGeometry args={[6.1, .13, 3.0]} /><meshStandardMaterial color="#087b55" roughness={.62} metalness={.08} /></mesh>
    {/* PCB silkscreen and mounting holes */}
    {[-2.75, 2.75].flatMap(x => [-1.22, 1.22].map(z => <mesh key={`${x}-${z}`} position={[x,.075,z]} rotation={[-Math.PI/2,0,0]}><cylinderGeometry args={[.12,.12,.015,24]} /><meshStandardMaterial color="#c8d4ce" /></mesh>))}
    {/* Main MCU */}
    <mesh castShadow position={[-.25,.18,-.05]}><boxGeometry args={[1.25,.27,.9]} /><meshStandardMaterial color="#171b20" roughness={.45} /></mesh>
    <mesh position={[-.25,.32,-.05]}><boxGeometry args={[.84,.012,.53]} /><meshStandardMaterial color="#252c33" /></mesh>
    {/* USB interface chip */}
    <mesh castShadow position={[-1.72,.16,-.3]}><boxGeometry args={[.72,.18,.54]} /><meshStandardMaterial color="#20262d" /></mesh>
    {/* USB-B connector */}
    <mesh castShadow position={[-2.72,.18,-.32]}><boxGeometry args={[.72,.42,.72]} /><meshStandardMaterial color="#a9b2ba" metalness={.8} roughness={.28} /></mesh>
    <mesh position={[-3.09,.18,-.32]}><boxGeometry args={[.08,.25,.44]} /><meshStandardMaterial color="#303941" metalness={.6} /></mesh>
    {/* DC jack */}
    <mesh castShadow position={[-2.75,.17,.65]}><boxGeometry args={[.62,.36,.65]} /><meshStandardMaterial color="#171c22" /></mesh>
    {/* Capacitors */}
    {[-1.95,-1.55,1.9,2.25].map((x,i)=><mesh key={i} castShadow position={[x,.29,i%2?.78:-.78]}><cylinderGeometry args={[.13,.13,.38,24]} /><meshStandardMaterial color="#202a34" metalness={.25} /></mesh>)}
    {/* Crystal */}
    <mesh castShadow position={[.78,.15,-.22]}><boxGeometry args={[.48,.13,.26]} /><meshStandardMaterial color="#c5cbd0" metalness={.85} /></mesh>
    {/* Reset button */}
    <mesh castShadow position={[2.55,.19,-.55]}><boxGeometry args={[.32,.22,.32]} /><meshStandardMaterial color="#d9dce0" metalness={.3} /></mesh>
    {/* Pin headers */}
    {headers.map(({name,x,z})=><group key={name} position={[x,.15,z]}>
      <mesh castShadow onClick={(e)=>{e.stopPropagation();onSelect(name)}}><boxGeometry args={[.19,.16,.19]} /><meshStandardMaterial color={selected===name?'#f5c451':pinColor(name)} metalness={.18} roughness={.35} /></mesh>
      <mesh position={[0,-.16,0]}><cylinderGeometry args={[.045,.045,.3,10]} /><meshStandardMaterial color="#d2b66b" metalness={.8} roughness={.25} /></mesh>
      <Html distanceFactor={13} position={[0,.17,0]}><button className="pin-label" onClick={(e)=>{e.stopPropagation();onSelect(name)}}>{name}</button></Html>
    </group>)}
    <mesh position={[0,.075,0]}><boxGeometry args={[5.6,.012,2.5]} /><meshStandardMaterial color="#0a694b" transparent opacity={.22} /></mesh>
  </group>
}
export default function Board3D({ pins, selected, onSelect }: { pins: PinResult[]; selected: string; onSelect: (p:string)=>void }) {
  return <div className="canvas-wrap">
    <Canvas camera={{ position: [7,6,7], fov: 38 }} shadows>
      <color attach="background" args={['#0b1420']} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[5,8,5]} intensity={2.2} castShadow />
      <pointLight position={[-4,3,-4]} intensity={.7} color="#64b5ff" />
      <UnoBoard pins={pins} selected={selected} onSelect={onSelect} />
      <ContactShadows position={[0,-.22,0]} opacity={.42} scale={10} blur={2.5} />
      <OrbitControls makeDefault minDistance={5} maxDistance={15} />
      <Environment preset="city" />
    </Canvas>
    <div className="model-hint">Drag to rotate · Scroll to zoom · Select a pin</div>
  </div>
}
