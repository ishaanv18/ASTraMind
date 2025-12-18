import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import NotificationContainer from './components/NotificationContainer';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CodebasesPage from './pages/CodebasesPage';
import CodebaseDetailPage from './pages/CodebaseDetailPage';
import SearchPage from './pages/SearchPage';
import DependencyGraphView from './components/DependencyGraphView';
import AstraMindAssistantPage from './pages/AstraMindAssistantPage';
import MetricsPage from './pages/MetricsPage';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/codebases" element={<CodebasesPage />} />
          <Route path="/codebases/:id" element={<CodebaseDetailPage />} />
          <Route path="/codebases/:id/search" element={<SearchPage />} />
          <Route path="/codebases/:id/graph" element={<DependencyGraphView />} />
          <Route path="/codebases/:id/metrics" element={<MetricsPage />} />
          <Route path="/codebases/:id/ai" element={<AstraMindAssistantPage />} />
        </Routes>
        <NotificationContainer />
      </Router>
    </AuthProvider>
  );
}

export default App;
