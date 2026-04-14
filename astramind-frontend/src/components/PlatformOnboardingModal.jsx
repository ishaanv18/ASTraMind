import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Check, BrainCircuit, Database, Shield, Terminal, MessageSquare, BookOpen } from 'lucide-react';
import useAppStore from '../store/appStore';
import './PlatformOnboardingModal.css';

const steps = [
  {
    icon: <BrainCircuit size={48} color="var(--accent-color)" />,
    title: "Welcome to Astramind",
    description: "The Intelligence Engine for your Codebase. Get ready to explore, debug, and understand your repositories with the power of AI."
  },
  {
    icon: <Database size={48} color="#A78BFA" />,
    title: "1. Index Your Workspace",
    description: "Click your repo name in the top left or the Workspace Manager button. You can index any GitHub repository or local folder. ASTraMind parses your code using Tree-sitter and builds a searchable vector index."
  },
  {
    icon: <BookOpen size={48} color="#34D399" />,
    title: "2. Explore Project About",
    description: "Once indexed, select the repo to view the Dashboard. The 'Project About' tab gives you a living overview, rendering the README visually along with your exact commit history and timezone-aware contributions."
  },
  {
    icon: <Shield size={48} color="#F87171" />,
    title: "3. Power Tools",
    description: "Navigate the sidebar for specific tools. Run Semantic Searches across millions of lines of code, spot vulnerabilities with Security, or analyze Architecture."
  },
  {
    icon: <Terminal size={48} color="#60A5FA" />,
    title: "4. Global Command Palette",
    description: "Press 'Ctrl+K' (or Cmd+K) anywhere to instantly search across the entire current codebase, open files, or trigger quick actions."
  },
  {
    icon: <MessageSquare size={48} color="#FBBF24" />,
    title: "5. Contextual AI Chat",
    description: "Need help? Open the AI Chat Sidebar on the right. It knows your currently active files and codebase context to give you precise answers."
  }
];

export default function PlatformOnboardingModal() {
  const { githubUser } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!githubUser) return;
    const key = `astramind_onboarding_completed_${githubUser.login}`;
    if (!localStorage.getItem(key)) {
      setIsOpen(true);
    }
  }, [githubUser]);

  const handleFinish = () => {
    if (githubUser) {
      localStorage.setItem(`astramind_onboarding_completed_${githubUser.login}`, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="onboarding-overlay">
      <motion.div 
        className="onboarding-modal glass-panel"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button className="onboarding-skip" onClick={handleFinish}>
          Skip <X size={16} />
        </button>

        <div className="onboarding-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              className="onboarding-slide"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="onboarding-icon-wrapper">
                {steps[currentStep].icon}
              </div>
              <h2 className="onboarding-title">{steps[currentStep].title}</h2>
              <p className="onboarding-desc">{steps[currentStep].description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="onboarding-footer">
          <div className="onboarding-dots">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={`onboarding-dot ${idx === currentStep ? 'active' : ''}`} 
                onClick={() => setCurrentStep(idx)}
              />
            ))}
          </div>

          <div className="onboarding-actions">
            {currentStep > 0 && (
              <button className="onboarding-btn secondary" onClick={() => setCurrentStep(s => s - 1)}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            
            {currentStep < steps.length - 1 ? (
              <button className="onboarding-btn primary" onClick={() => setCurrentStep(s => s + 1)}>
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button className="onboarding-btn primary finish" onClick={handleFinish}>
                Let's Go <Check size={16} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
