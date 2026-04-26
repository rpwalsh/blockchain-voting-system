import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from '../contexts/ThemeContext';
import './Election3D.css';

interface CountyData {
  fips: string;
  name: string;
  state: string;
  votesGOP: number;
  votesDEM: number;
  totalVotes: number;
  percentGOP: number;
  percentDEM: number;
  winner: 'GOP' | 'DEM';
  margin: number;
  reportedAt: Date;
  population?: number;
}

interface County3DProps {
  county: CountyData;
  position: [number, number, number];
  onHover: (county: CountyData | null) => void;
}

// Calculate mixed color based on vote distribution
const getMixedColor = (gop: number, dem: number, other: number, total: number) => {
  if (total === 0) return new THREE.Color(0.5, 0.5, 0.5); // Grey for no data
  
  const gopPct = gop / total;
  const demPct = dem / total;
  const otherPct = other / total;
  
  // Start with base colors
  const red = new THREE.Color(0.8, 0.2, 0.2);   // GOP red
  const blue = new THREE.Color(0.2, 0.3, 0.8);  // DEM blue
  const purple = new THREE.Color(0.6, 0.3, 0.6); // Other/mixed
  
  // Mix colors based on percentages
  const r = (red.r * gopPct) + (blue.r * demPct) + (purple.r * otherPct);
  const g = (red.g * gopPct) + (blue.g * demPct) + (purple.g * otherPct);
  const b = (red.b * gopPct) + (blue.b * demPct) + (purple.b * otherPct);
  
  return new THREE.Color(r, g, b);
};

const County3DBar: React.FC<County3DProps> = ({ county, position, onHover }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  // Calculate height based on population (normalize to reasonable range)
  const population = county.population || county.totalVotes * 2;
  const baseHeight = Math.log10(population) * 0.3; // Logarithmic scale
  const height = Math.max(0.5, baseHeight);
  
  // Calculate "other" votes
  const otherVotes = county.totalVotes - county.votesGOP - county.votesDEM;
  
  // Get mixed color
  const color = getMixedColor(
    county.votesGOP,
    county.votesDEM,
    otherVotes,
    county.totalVotes
  );
  
  // Voter turnout indicator (darker = lower turnout)
  const turnoutEstimate = county.totalVotes / population;
  const brightness = Math.min(1, 0.3 + turnoutEstimate * 2);
  color.multiplyScalar(brightness);
  
  useFrame(() => {
    if (meshRef.current && hovered) {
      meshRef.current.scale.x = 1.2;
      meshRef.current.scale.z = 1.2;
    } else if (meshRef.current) {
      meshRef.current.scale.x = 1;
      meshRef.current.scale.z = 1;
    }
  });
  
  return (
    <mesh
      ref={meshRef}
      position={[position[0], height / 2, position[2]]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(county);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
        document.body.style.cursor = 'auto';
      }}
    >
      <boxGeometry args={[0.08, height, 0.08]} />
      <meshStandardMaterial
        color={color}
        emissive={hovered ? color : new THREE.Color(0, 0, 0)}
        emissiveIntensity={hovered ? 0.5 : 0}
        roughness={0.3}
        metalness={0.6}
      />
    </mesh>
  );
};

const Scene: React.FC<{
  counties: CountyData[];
  onHover: (county: CountyData | null) => void;
}> = ({ counties, onHover }) => {
  // Arrange counties in a grid based on their geographic distribution
  const getPosition = (index: number): [number, number, number] => {
    const gridSize = Math.ceil(Math.sqrt(counties.length));
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    
    const x = (col - gridSize / 2) * 0.1;
    const z = (row - gridSize / 2) * 0.1;
    
    return [x, 0, z];
  };
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1a2e" opacity={0.5} transparent />
      </mesh>
      
      {/* County bars */}
      {counties.map((county, index) => (
        <County3DBar
          key={`${county.fips}-${index}`}
          county={county}
          position={getPosition(index)}
          onHover={onHover}
        />
      ))}
    </>
  );
};

const Election3D: React.FC = () => {
  const { darkMode } = useTheme();
  const [counties, setCounties] = useState<CountyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCounty, setHoveredCounty] = useState<CountyData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [displayedCounties, setDisplayedCounties] = useState<CountyData[]>([]);
  
  // Load all county data
  useEffect(() => {
    loadAllCounties();
  }, []);
  
  const loadAllCounties = async () => {
    try {
      let allCounties: CountyData[] = [];
      let page = 0;
      const limit = 500;
      
      while (true) {
        const response = await fetch(
          `http://localhost:3000/api/election-data/timeline?page=${page}&limit=${limit}`
        );
        
        if (!response.ok) break;
        
        const data = await response.json();
        if (!data.data || data.data.length === 0) break;
        
        allCounties = [...allCounties, ...data.data];
        page++;
        
        if (data.data.length < limit) break;
      }
      
      setCounties(allCounties);
      setCurrentIndex(allCounties.length - 1); // Start at final frame
      setDisplayedCounties(allCounties);
      setLoading(false);
    } catch (error) {
      console.error('Error loading counties:', error);
      setLoading(false);
    }
  };
  
  // Playback controls
  useEffect(() => {
    if (playing && currentIndex < counties.length - 1) {
      const timer = setTimeout(() => {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setDisplayedCounties(counties.slice(0, nextIndex + 1));
      }, 50);
      return () => clearTimeout(timer);
    } else if (playing && currentIndex >= counties.length - 1) {
      setPlaying(false);
    }
  }, [playing, currentIndex, counties]);
  
  const handlePlayPause = () => {
    if (currentIndex >= counties.length - 1) {
      setCurrentIndex(0);
      setDisplayedCounties([]);
    }
    setPlaying(!playing);
  };
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    setCurrentIndex(index);
    setDisplayedCounties(counties.slice(0, index + 1));
    setPlaying(false);
  };
  
  if (loading) {
    return (
      <div className={`election-3d ${darkMode ? 'dark-mode' : ''}`}>
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading 3D election data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`election-3d ${darkMode ? 'dark-mode' : ''}`}>
      <div className="election-header">
        <h1>2024 Election - 3D Interactive Visualization</h1>
        <p>Mixed vote distribution with population bars</p>
        <div className="legend">
          <div className="legend-item">
            <span className="legend-color gop"></span>
            <span>GOP Dominant</span>
          </div>
          <div className="legend-item">
            <span className="legend-color purple"></span>
            <span>Mixed/Purple</span>
          </div>
          <div className="legend-item">
            <span className="legend-color dem"></span>
            <span>DEM Dominant</span>
          </div>
          <div className="legend-item">
            <span className="legend-color other"></span>
            <span>Other/Low Turnout</span>
          </div>
        </div>
      </div>
      
      <div className="controls-panel">
        <button className="play-btn" onClick={handlePlayPause}>
          {playing ? '⏸ Pause' : currentIndex >= counties.length - 1 ? '🔄 Replay' : '▶️ Play'}
        </button>
        
        <div className="timeline">
          <input
            type="range"
            min="0"
            max={counties.length - 1}
            value={currentIndex}
            onChange={handleSliderChange}
            className="timeline-slider"
            aria-label="Election timeline scrubber"
            title={`County ${currentIndex + 1} of ${counties.length}`}
          />
          <div className="timeline-info">
            County {currentIndex + 1} of {counties.length}
          </div>
        </div>
      </div>
      
      <div className="canvas-section">
        <div className="canvas-header">
          <h2>3D Vote Distribution Map - {displayedCounties.length.toLocaleString()} counties</h2>
          <Link to="/election-2024" className="switch-view-btn" title="Switch to 2D Map View">
            🗺️ Switch to 2D Map
          </Link>
        </div>
        <div className="canvas-container">
          <Canvas shadows>
            <PerspectiveCamera makeDefault position={[0, 8, 12]} fov={60} />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={5}
              maxDistance={30}
              minPolarAngle={Math.PI / 6}
              maxPolarAngle={Math.PI / 2.5}
            />
            <Suspense fallback={null}>
              <Scene counties={displayedCounties} onHover={setHoveredCounty} />
            </Suspense>
          </Canvas>
        
        {hoveredCounty && (
          <div className="hover-tooltip">
            <h3>{hoveredCounty.name}, {hoveredCounty.state}</h3>
            <div className="vote-breakdown">
              <div className="vote-row gop">
                <span>GOP:</span>
                <span>{hoveredCounty.votesGOP.toLocaleString()} ({(hoveredCounty.votesGOP / hoveredCounty.totalVotes * 100).toFixed(1)}%)</span>
              </div>
              <div className="vote-row dem">
                <span>DEM:</span>
                <span>{hoveredCounty.votesDEM.toLocaleString()} ({(hoveredCounty.votesDEM / hoveredCounty.totalVotes * 100).toFixed(1)}%)</span>
              </div>
              <div className="vote-row other">
                <span>Other:</span>
                <span>{(hoveredCounty.totalVotes - hoveredCounty.votesGOP - hoveredCounty.votesDEM).toLocaleString()} ({((hoveredCounty.totalVotes - hoveredCounty.votesGOP - hoveredCounty.votesDEM) / hoveredCounty.totalVotes * 100).toFixed(1)}%)</span>
              </div>
              <div className="vote-row total">
                <span>Total:</span>
                <span>{hoveredCounty.totalVotes.toLocaleString()}</span>
              </div>
              {hoveredCounty.population && (
                <div className="vote-row population">
                  <span>Population:</span>
                  <span>{hoveredCounty.population.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
      
      <div className="info-panel">
        <h3>How to Interact:</h3>
        <ul>
          <li>🖱️ <strong>Left Click + Drag:</strong> Rotate view</li>
          <li>🔍 <strong>Scroll:</strong> Zoom in/out</li>
          <li>👆 <strong>Right Click + Drag:</strong> Pan camera</li>
          <li>🎯 <strong>Hover:</strong> See county details</li>
        </ul>
        
        <h3>Visualization Key:</h3>
        <ul>
          <li>📊 <strong>Bar Height:</strong> County population (logarithmic scale)</li>
          <li>🎨 <strong>Bar Color:</strong> Vote distribution (red/blue/purple mix)</li>
          <li>💡 <strong>Brightness:</strong> Voter turnout (darker = lower turnout)</li>
          <li>🔴 <strong>Red:</strong> GOP votes</li>
          <li>🔵 <strong>Blue:</strong> DEM votes</li>
          <li>🟣 <strong>Purple:</strong> Mixed or other votes</li>
        </ul>
      </div>
    </div>
  );
};

export default Election3D;
