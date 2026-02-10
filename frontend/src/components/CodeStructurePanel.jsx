import React, { useState } from 'react';
import './CodeStructurePanel.css';

function CodeStructurePanel({ structure, onMethodClick }) {
    const [expandedClasses, setExpandedClasses] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    const toggleClass = (classId) => {
        const newExpanded = new Set(expandedClasses);
        if (newExpanded.has(classId)) {
            newExpanded.delete(classId);
        } else {
            newExpanded.add(classId);
        }
        setExpandedClasses(newExpanded);
    };

    if (!structure || !structure.classes) {
        return (
            <div className="code-structure-panel">
                <div className="structure-header">
                    <h3>📦 Code Structure</h3>
                </div>
                <div className="empty-structure">
                    <p>Click "Parse Code" to analyze the codebase</p>
                </div>
            </div>
        );
    }

    const filteredClasses = structure.classes.filter(cls =>
        cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.packageName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="code-structure-panel">
            <div className="structure-header">
                <h3>📦 Code Structure</h3>
                <span className="class-count">{structure.totalClasses} classes</span>
            </div>

            <div className="structure-search">
                <input
                    type="text"
                    placeholder="Search classes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="structure-search-input"
                />
            </div>

            <div className="structure-content">
                {filteredClasses.map(cls => {
                    const isExpanded = expandedClasses.has(cls.id);
                    const icon = cls.isInterface ? '🔷' : '📦';

                    return (
                        <div key={cls.id} className="class-item">
                            <div
                                className="class-header"
                                onClick={() => toggleClass(cls.id)}
                            >
                                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                                <span className="class-icon">{icon}</span>
                                <div className="class-info">
                                    <span className="class-name">{cls.name}</span>
                                    {cls.packageName && (
                                        <span className="package-name">{cls.packageName}</span>
                                    )}
                                </div>
                                <span className="method-count">{cls.methods?.length || 0}m</span>
                            </div>

                            {isExpanded && (
                                <div className="class-details">
                                    {cls.extendsClass && (
                                        <div className="extends-info">
                                            <span className="extends-label">extends</span>
                                            <span className="extends-class">{cls.extendsClass}</span>
                                        </div>
                                    )}

                                    {cls.fields && cls.fields.length > 0 && (
                                        <div className="fields-section">
                                            <div className="section-title">📌 Fields ({cls.fields.length})</div>
                                            {cls.fields.map(field => (
                                                <div key={field.id} className="field-item">
                                                    <span className="field-icon">
                                                        {field.isStatic ? '🔸' : '🔹'}
                                                    </span>
                                                    <span className="field-name">{field.name}</span>
                                                    <span className="field-type">{field.type}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {cls.methods && cls.methods.length > 0 && (
                                        <div className="methods-section">
                                            <div className="section-title">🔧 Methods ({cls.methods.length})</div>
                                            {cls.methods.map(method => (
                                                <div
                                                    key={method.id}
                                                    className="method-item"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onMethodClick && onMethodClick(cls.fileId, method.startLine);
                                                    }}
                                                >
                                                    <span className="method-icon">
                                                        {method.isStatic ? '⚡' : '🔧'}
                                                    </span>
                                                    <div className="method-info">
                                                        <span className="method-name">{method.name}</span>
                                                        <span className="method-params">({method.parameters || ''})</span>
                                                        {method.returnType && (
                                                            <span className="return-type">: {method.returnType}</span>
                                                        )}
                                                    </div>
                                                    <span className="line-number">L{method.startLine}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default CodeStructurePanel;
