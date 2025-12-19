import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './DependencyGraphView.css';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../hooks/useNotification';
import NotificationContainer from './NotificationContainer';
import API_BASE_URL from '../config/apiConfig';

function DependencyGraphView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { notifications, addNotification, removeNotification } = useNotification();

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    const [graphStats, setGraphStats] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNode, setSelectedNode] = useState(null);
    const [layout, setLayout] = useState('circular'); // circular or hierarchical
    const [selectedFilters, setSelectedFilters] = useState({
        IMPORTS: true,
        EXTENDS: true,
        IMPLEMENTS: true,
        USES: true
    });

    useEffect(() => {
        loadGraph();
    }, [id]);

    useEffect(() => {
        if (nodes.length > 0) {
            applyLayout();
        }
    }, [layout, nodes.length]); // Added nodes.length to dependency array to re-apply layout if nodes change

    const loadGraph = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/codebases/${id}/graph`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load graph');
            }

            const data = await response.json();

            // Transform nodes for React Flow
            const flowNodes = data.nodes.map((node, index) => ({
                id: node.id,
                type: 'default',
                data: {
                    label: node.label,
                    package: node.package,
                    methodCount: node.methodCount,
                    fieldCount: node.fieldCount,
                    isInterface: node.isInterface,
                    fullyQualifiedName: node.fullyQualifiedName
                },
                position: calculateCircularPosition(index, data.nodes.length),
                style: {
                    background: node.color,
                    color: 'white',
                    border: node.isInterface ? '2px dashed #fff' : '2px solid #fff',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    minWidth: '120px',
                    textAlign: 'center'
                }
            }));

            // Transform edges for React Flow
            const flowEdges = data.edges
                .filter(edge => !edge.isExternal) // Filter out external dependencies for now
                .map(edge => ({
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    type: 'smoothstep',
                    label: edge.label,
                    animated: edge.type === 'EXTENDS',
                    style: { stroke: edge.color, strokeWidth: 2 },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: edge.color,
                    },
                    data: { type: edge.type }
                }));

            setNodes(flowNodes);
            setEdges(flowEdges);
            setGraphStats(data.stats);
            addNotification(`Loaded graph with ${data.stats.totalClasses} classes`, 'success');
            setLoading(false);
        } catch (error) {
            console.error('Error loading graph:', error);
            addNotification('Failed to load dependency graph', 'error');
            setLoading(false); // Ensure loading is set to false even on error
        }
    };

    // Calculate position in a circular layout
    const calculateCircularPosition = (index, total) => {
        const radius = Math.min(400, total * 20);
        const angle = (index / total) * 2 * Math.PI;
        return {
            x: 500 + radius * Math.cos(angle),
            y: 400 + radius * Math.sin(angle)
        };
    };

    // Calculate hierarchical layout
    const calculateHierarchicalPosition = (index, total) => {
        const cols = Math.ceil(Math.sqrt(total));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
            x: col * 200 + 100,
            y: row * 150 + 100
        };
    };

    // Apply layout
    const applyLayout = useCallback(() => {
        setNodes(nds => nds.map((node, index) => ({
            ...node,
            position: layout === 'circular'
                ? calculateCircularPosition(index, nds.length)
                : calculateHierarchicalPosition(index, nds.length)
        })));
    }, [layout, setNodes]);

    // Handle node click
    const onNodeClick = useCallback((event, node) => {
        setSelectedNode(node);
        addNotification(`Selected: ${node.data.label}`, 'info');
    }, [addNotification]);

    // Filter nodes by search query
    const filteredNodes = useMemo(() => {
        if (!searchQuery) return nodes;
        return nodes.filter(node =>
            node.data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            node.data.package?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [nodes, searchQuery]);

    // Filter edges by selected relationship types
    const filteredEdges = useMemo(() => {
        return edges.filter(edge => {
            const edgeType = edge.data?.type;
            return edgeType && selectedFilters[edgeType] === true;
        });
    }, [edges, selectedFilters]);

    const toggleFilter = (type) => {
        setSelectedFilters(prev => ({
            ...prev,
            [type]: !prev[type]
        }));
    };

    // Calculate visible edge counts for each type using useMemo
    const edgeCounts = useMemo(() => {
        const counts = {
            IMPORTS: 0,
            EXTENDS: 0,
            IMPLEMENTS: 0,
            USES: 0
        };

        edges.forEach(edge => {
            const type = edge.data?.type;
            if (type && counts.hasOwnProperty(type) && selectedFilters[type]) {
                counts[type]++;
            }
        });

        return counts;
    }, [edges, selectedFilters]);

    if (loading) {
        return (
            <div className="graph-view">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading dependency graph...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="graph-view">
            {/* Header */}
            <header className="graph-header">
                <div className="header-left">
                    <button onClick={() => navigate(`/codebases/${id}`)} className="back-btn">
                        ← Back to Code
                    </button>
                    <h1>Dependency Graph</h1>
                    {graphStats && (
                        <span className="stats">
                            {graphStats.totalClasses} classes · {graphStats.totalRelationships} relationships
                        </span>
                    )}
                </div>
                <div className="header-right">
                    <span className="username">{user?.username}</span>
                    <button onClick={logout} className="logout-btn">Logout</button>
                </div>
            </header>

            {/* Controls */}
            <div className="graph-controls">
                <input
                    type="text"
                    placeholder="Search classes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
                <div className="layout-controls">
                    <button
                        className={`layout-btn ${layout === 'circular' ? 'active' : ''}`}
                        onClick={() => setLayout('circular')}
                    >
                        ⭕ Circular
                    </button>
                    <button
                        className={`layout-btn ${layout === 'hierarchical' ? 'active' : ''}`}
                        onClick={() => setLayout('hierarchical')}
                    >
                        📊 Grid
                    </button>
                </div>
                <div className="filters">
                    <button
                        className={`filter-btn ${selectedFilters.IMPORTS ? 'active' : ''}`}
                        onClick={() => toggleFilter('IMPORTS')}
                        style={{ borderColor: '#3b82f6' }}
                    >
                        🔵 Imports ({edgeCounts.IMPORTS || graphStats?.byType?.IMPORTS || 0}/{graphStats?.byType?.IMPORTS || 0})
                    </button>
                    <button
                        className={`filter-btn ${selectedFilters.EXTENDS ? 'active' : ''}`}
                        onClick={() => toggleFilter('EXTENDS')}
                        style={{ borderColor: '#10b981' }}
                    >
                        🟢 Extends ({edgeCounts.EXTENDS || graphStats?.byType?.EXTENDS || 0}/{graphStats?.byType?.EXTENDS || 0})
                    </button>
                    <button
                        className={`filter-btn ${selectedFilters.IMPLEMENTS ? 'active' : ''}`}
                        onClick={() => toggleFilter('IMPLEMENTS')}
                        style={{ borderColor: '#8b5cf6' }}
                    >
                        🟣 Implements ({edgeCounts.IMPLEMENTS || graphStats?.byType?.IMPLEMENTS || 0}/{graphStats?.byType?.IMPLEMENTS || 0})
                    </button>
                    <button
                        className={`filter-btn ${selectedFilters.USES ? 'active' : ''}`}
                        onClick={() => toggleFilter('USES')}
                        style={{ borderColor: '#f59e0b' }}
                    >
                        🟠 Uses ({edgeCounts.USES || graphStats?.byType?.USES || 0}/{graphStats?.byType?.USES || 0})
                    </button>
                </div>
            </div>

            <div className="graph-main">
                {/* React Flow Graph */}
                <div className="graph-container">
                    <ReactFlow
                        nodes={filteredNodes}
                        edges={filteredEdges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={onNodeClick}
                        fitView
                        attributionPosition="bottom-left"
                    >
                        <Background color="#1f2937" gap={16} />
                        <Controls />
                        <MiniMap
                            nodeColor={(node) => node.style.background}
                            maskColor="rgba(0, 0, 0, 0.6)"
                        />
                    </ReactFlow>
                </div>

                {/* Details Panel */}
                {selectedNode && (
                    <div className="details-panel">
                        <div className="panel-header">
                            <h3>Class Details</h3>
                            <button onClick={() => setSelectedNode(null)} className="close-btn">✕</button>
                        </div>
                        <div className="panel-content">
                            <div className="detail-item">
                                <span className="label">Name:</span>
                                <span className="value">{selectedNode.data.label}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Package:</span>
                                <span className="value">{selectedNode.data.package || 'default'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Fully Qualified:</span>
                                <span className="value code">{selectedNode.data.fullyQualifiedName}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Type:</span>
                                <span className="value">{selectedNode.data.isInterface ? 'Interface' : 'Class'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Methods:</span>
                                <span className="value">{selectedNode.data.methodCount}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Fields:</span>
                                <span className="value">{selectedNode.data.fieldCount}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <NotificationContainer notifications={notifications} onRemove={removeNotification} />
        </div>
    );
}

export default DependencyGraphView;
