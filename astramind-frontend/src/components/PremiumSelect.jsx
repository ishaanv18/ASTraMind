import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import './PremiumSelect.css';

export default function PremiumSelect({ value, onChange, options, placeholder = "Select an option", disabled = false, style }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`premium-select-container ${disabled ? 'disabled' : ''}`} ref={containerRef} style={style}>
      <div 
        className={`premium-select-trigger grid-panel ${isOpen ? 'open' : ''}`} 
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="premium-select-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={18} className={`premium-select-icon ${isOpen ? 'rotate' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="premium-select-dropdown glass-panel"
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {options.map((opt) => (
              <div 
                key={opt.value}
                className={`premium-select-option ${value === opt.value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {value === opt.value && <Check size={16} className="premium-select-check" />}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
