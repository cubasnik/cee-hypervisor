import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VirtualMachines from './pages/VirtualMachines';
import Images from './pages/Images';
import Snapshots from './pages/Snapshots';
import Servers from './pages/Servers';
import Clusters from './pages/Clusters';
import Network from './pages/Network';
import Storage from './pages/Storage';

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="App bg-dark-900 text-white min-h-screen">
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/vms" element={<VirtualMachines />} />
            <Route path="/images" element={<Images />} />
            <Route path="/snapshots" element={<Snapshots />} />
            <Route path="/servers" element={<Servers />} />
            <Route path="/clusters" element={<Clusters />} />
            <Route path="/network" element={<Network />} />
            <Route path="/storage" element={<Storage />} />
          </Routes>
        </Layout>
      </div>
    </Router>
  );
}

export default App;