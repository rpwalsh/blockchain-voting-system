/**
 * US ELECTION MAP 2024 - REAL DATA
 * =================================
 * Interactive county-level map showing actual 2024 presidential results
 * Data: 154,863,739 total votes across 3,160 counties
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import axios from 'axios';
import './USElectionMap.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// TopoJSON URLs for US map data
const US_STATES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const US_COUNTIES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

// Color scales
const GOP_COLOR = '#E81B23';  // Republican red
const DEM_COLOR = '#0015BC';  // Democrat blue
const NEUTRAL_COLOR = '#E5E7EB';

interface NationalData {
  year: number;
  candidates: {
    gop: { name: string; party: string };
    dem: { name: string; party: string };
  };
  votes: {
    total: number;
    gop: number;
    dem: number;
    gopPercent: string;
    demPercent: string;
  };
  electoral: {
    gop: number;
    dem: number;
    needed: number;
    winner: string;
  };
  winner: {
    party: string;
    name: string;
  };
}

interface StateData {
  id: string;
  name: string;
  abbreviation: string;
  votes: {
    total: number;
    gop: number;
    dem: number;
    gopPercent: string;
    demPercent: string;
  };
  electoral: number;
  winner: string;
}

interface MapData {
  counties: Record<string, {
    n: string;  // name
    s: string;  // stateId
    w: string;  // winner
    pg: number; // percentGop
    pd: number; // percentDem
    t: number;  // totalVotes
    g: number;  // gopVotes
    d: number;  // demVotes
  }>;
  states: Record<string, {
    n: string;  // name
    a: string;  // abbreviation
    w: string;  // winner
    e: number;  // electoral
    t: number;  // totalVotes
    g: number;  // gopVotes
    d: number;  // demVotes
  }>;
}

export default function USElectionMap() {
  const [national, setNational] = useState<NationalData | null>(null);
  const [states, setStates] = useState<StateData[]>([]);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Map interaction state
  const [viewMode, setViewMode] = useState<'states' | 'counties'>('states');
  const [_hoveredGeo, setHoveredGeo] = useState<string | null>(null);
  const [_selectedState, setSelectedState] = useState<StateData | null>(null);
  const [tooltipContent, setTooltipContent] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([-96, 38]);

  // Color scale for margin visualization
  const colorScale = useMemo(() => 
    scaleLinear<string>()
      .domain([-1, -0.1, 0, 0.1, 1])
      .range([DEM_COLOR, '#7B9CD4', NEUTRAL_COLOR, '#E08080', GOP_COLOR]),
    []
  );

  useEffect(() => {
    loadElectionData();
  }, []);

  const loadElectionData = async () => {
    try {
      setLoading(true);
      const [nationalRes, statesRes, mapRes] = await Promise.all([
        axios.get(`${API_BASE}/election-data/national`),
        axios.get(`${API_BASE}/election-data/states`),
        axios.get(`${API_BASE}/election-data/map`),
      ]);
      
      setNational(nationalRes.data);
      setStates(statesRes.data);
      setMapData(mapRes.data);
      setError('');
    } catch (err: any) {
      console.error('Failed to load election data:', err);
      setError(err.response?.data?.error || 'Failed to load election data');
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = useCallback((geoId: string) => {
    if (!mapData) return NEUTRAL_COLOR;
    
    // geoId from TopoJSON is numeric (e.g., "06" for California)
    const stateId = geoId.padStart(2, '0');
    const state = mapData.states[stateId];
    
    if (!state) return NEUTRAL_COLOR;
    
    // Calculate margin
    const margin = state.t > 0 ? (state.g - state.d) / state.t : 0;
    return colorScale(margin);
  }, [mapData, colorScale]);

  const getCountyColor = useCallback((geoId: string) => {
    if (!mapData) return NEUTRAL_COLOR;
    
    const county = mapData.counties[geoId];
    if (!county) return NEUTRAL_COLOR;
    
    // Calculate margin
    const margin = county.t > 0 ? (county.g - county.d) / county.t : 0;
    return colorScale(margin);
  }, [mapData, colorScale]);

  const handleGeoHover = useCallback((geo: any, e: React.MouseEvent) => {
    if (!mapData) return;
    
    const geoId = geo.id?.toString() || geo.properties?.GEOID;
    setHoveredGeo(geoId);
    
    if (viewMode === 'states') {
      const stateId = geoId?.padStart(2, '0');
      const state = mapData.states[stateId];
      if (state) {
        setTooltipContent({
          type: 'state',
          name: state.n,
          abbrev: state.a,
          winner: state.w,
          electoral: state.e,
          votes: {
            total: state.t,
            gop: state.g,
            dem: state.d,
            gopPercent: state.t > 0 ? ((state.g / state.t) * 100).toFixed(1) : '0',
            demPercent: state.t > 0 ? ((state.d / state.t) * 100).toFixed(1) : '0',
          }
        });
      }
    } else {
      const county = mapData.counties[geoId];
      const state = county ? mapData.states[county.s] : null;
      if (county && state) {
        setTooltipContent({
          type: 'county',
          name: county.n,
          state: state.n,
          stateAbbrev: state.a,
          winner: county.w,
          votes: {
            total: county.t,
            gop: county.g,
            dem: county.d,
            gopPercent: (county.pg * 100).toFixed(1),
            demPercent: (county.pd * 100).toFixed(1),
          }
        });
      }
    }
    
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  }, [mapData, viewMode]);

  const handleGeoLeave = useCallback(() => {
    setHoveredGeo(null);
    setTooltipContent(null);
  }, []);

  const handleStateClick = useCallback((_geoId: string) => {
    if (viewMode === 'states') {
      // Zoom into state and show counties
      setViewMode('counties');
      // Could zoom to state bounds here
    }
  }, [viewMode]);

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 8));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.5, 1));
  const handleReset = () => {
    setZoom(1);
    setCenter([-96, 38]);
    setViewMode('states');
    setSelectedState(null);
  };

  if (loading) {
    return (
      <div className="election-map-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading 2024 Election Data...</p>
          <p className="loading-sub">154+ million votes across 3,160 counties</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="election-map-container">
        <div className="error-state">
          <h2>⚠️ Error Loading Election Data</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={loadElectionData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="election-map-container">
      {/* Header with national results */}
      <div className="map-header">
        <div className="header-title">
          <h1>🇺🇸 2024 Presidential Election Results</h1>
          <p className="subtitle">Real county-level data • {national?.votes.total.toLocaleString()} total votes</p>
        </div>
        
        {national && (
          <div className="electoral-summary">
            <div className="candidate-box gop">
              <div className="candidate-name">{national.candidates.gop.name}</div>
              <div className="electoral-votes">{national.electoral.gop}</div>
              <div className="popular-votes">{national.votes.gop.toLocaleString()} ({national.votes.gopPercent}%)</div>
              {national.winner.party === 'GOP' && <div className="winner-badge">✓ WINNER</div>}
            </div>
            
            <div className="electoral-bar">
              <div className="bar-container">
                <div 
                  className="bar-fill gop" 
                  style={{ width: `${(national.electoral.gop / 538) * 100}%` }}
                />
                <div 
                  className="bar-fill dem" 
                  style={{ width: `${(national.electoral.dem / 538) * 100}%`, left: `${(national.electoral.gop / 538) * 100}%` }}
                />
              </div>
              <div className="bar-label">270 to win</div>
            </div>
            
            <div className="candidate-box dem">
              <div className="candidate-name">{national.candidates.dem.name}</div>
              <div className="electoral-votes">{national.electoral.dem}</div>
              <div className="popular-votes">{national.votes.dem.toLocaleString()} ({national.votes.demPercent}%)</div>
              {national.winner.party === 'DEM' && <div className="winner-badge">✓ WINNER</div>}
            </div>
          </div>
        )}
      </div>

      {/* Map controls */}
      <div className="map-controls">
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${viewMode === 'states' ? 'active' : ''}`}
            onClick={() => setViewMode('states')}
          >
            States
          </button>
          <button 
            className={`toggle-btn ${viewMode === 'counties' ? 'active' : ''}`}
            onClick={() => setViewMode('counties')}
          >
            Counties
          </button>
        </div>
        
        <div className="zoom-controls">
          <button onClick={handleZoomIn} title="Zoom In">+</button>
          <button onClick={handleZoomOut} title="Zoom Out">−</button>
          <button onClick={handleReset} title="Reset">⟲</button>
        </div>
      </div>

      {/* Main map */}
      <div className="map-wrapper">
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1000 }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup
            zoom={zoom}
            center={center}
            onMoveEnd={({ coordinates, zoom: z }) => {
              setCenter(coordinates as [number, number]);
              setZoom(z);
            }}
          >
            <Geographies geography={viewMode === 'states' ? US_STATES_URL : US_COUNTIES_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const geoId = geo.id?.toString() || geo.properties?.GEOID;
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={viewMode === 'states' ? getStateColor(geoId) : getCountyColor(geoId)}
                      stroke="#FFF"
                      strokeWidth={viewMode === 'states' ? 0.5 : 0.1}
                      style={{
                        default: { outline: 'none' },
                        hover: { 
                          outline: 'none',
                          fill: viewMode === 'states' ? getStateColor(geoId) : getCountyColor(geoId),
                          strokeWidth: 2,
                          stroke: '#000',
                        },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={(e) => handleGeoHover(geo, e)}
                      onMouseLeave={handleGeoLeave}
                      onClick={() => handleStateClick(geoId)}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {tooltipContent && (
          <div 
            className="map-tooltip"
            style={{ 
              left: tooltipPosition.x + 15, 
              top: tooltipPosition.y - 10,
            }}
          >
            <div className="tooltip-header">
              <strong>
                {tooltipContent.name}
                {tooltipContent.type === 'county' && `, ${tooltipContent.stateAbbrev}`}
              </strong>
              {tooltipContent.electoral && (
                <span className="electoral-badge">{tooltipContent.electoral} EV</span>
              )}
            </div>
            <div className="tooltip-results">
              <div className="result-row gop">
                <span>Trump (R)</span>
                <span>{tooltipContent.votes.gop.toLocaleString()} ({tooltipContent.votes.gopPercent}%)</span>
              </div>
              <div className="result-row dem">
                <span>Harris (D)</span>
                <span>{tooltipContent.votes.dem.toLocaleString()} ({tooltipContent.votes.demPercent}%)</span>
              </div>
            </div>
            <div className={`tooltip-winner ${tooltipContent.winner?.toLowerCase()}`}>
              {tooltipContent.winner === 'GOP' ? '🔴 Trump wins' : '🔵 Harris wins'}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="map-legend">
        <div className="legend-title">Vote Margin</div>
        <div className="legend-scale">
          <div className="legend-gradient"></div>
          <div className="legend-labels">
            <span>D +50%</span>
            <span>Even</span>
            <span>R +50%</span>
          </div>
        </div>
      </div>

      {/* State list sidebar */}
      <div className="states-sidebar">
        <h3>States ({states.length})</h3>
        <div className="states-list">
          {states.map(state => (
            <div 
              key={state.id} 
              className={`state-item ${state.winner?.toLowerCase()}`}
              onClick={() => setSelectedState(state)}
            >
              <div className="state-name">
                <span className={`winner-dot ${state.winner?.toLowerCase()}`}></span>
                {state.abbreviation}
              </div>
              <div className="state-ev">{state.electoral} EV</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
