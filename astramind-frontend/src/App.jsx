import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Search from './pages/Search';
import Debug from './pages/Debug';
import Diff from './pages/Diff';
import Deps from './pages/Deps';
import Architecture from './pages/Architecture';
import Security from './pages/Security';
import Tests from './pages/Tests';
import Review from './pages/Review';
import Onboarding from './pages/Onboarding';
import NLQuery from './pages/NLQuery';
import PairProgrammer from './pages/PairProgrammer';
import ADR from './pages/ADR';
import Commits from './pages/Commits';
import Timemachine from './pages/Timemachine';
import Trends from './pages/Trends';
import DashboardHome from './pages/DashboardHome';
import ProjectAbout from './pages/ProjectAbout';

const App = () => {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<Home />} />

      {/* All dashboard routes require GitHub auth */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard"   element={<DashboardHome />} />
        <Route path="/about"       element={<ProjectAbout />} />
        <Route path="/search"      element={<Search />} />
        <Route path="/debug"       element={<Debug />} />
        <Route path="/diff"        element={<Diff />} />
        <Route path="/deps"        element={<Deps />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/onboard"     element={<Onboarding />} />
        <Route path="/security"    element={<Security />} />
        <Route path="/tests"       element={<Tests />} />
        <Route path="/review"      element={<Review />} />
        <Route path="/nl-query"    element={<NLQuery />} />
        <Route path="/pair"        element={<PairProgrammer />} />
        <Route path="/adr"         element={<ADR />} />
        <Route path="/commits"     element={<Commits />} />
        <Route path="/timemachine" element={<Timemachine />} />
        <Route path="/trends"      element={<Trends />} />
        <Route path="*"            element={<div style={{padding:'2rem',textAlign:'center'}}>Feature Coming Soon!</div>} />
      </Route>
    </Routes>
  );
};

export default App;
