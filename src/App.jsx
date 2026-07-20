import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Hub } from "./hub/Hub.jsx";
import { JoeStudio } from "./joe/JoeStudio.jsx";
import { DragonStudio } from "./dragon/DragonStudio.jsx";
import { ProductionStudio } from "./studio/ProductionStudio.jsx";
import { BirdLive } from "./bird/BirdLive.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/studio" element={<ProductionStudio />} />
      <Route path="/41birdlive" element={<BirdLive />} />
      <Route path="/bird-live" element={<Navigate to="/41birdlive" replace />} />
      <Route path="/joe" element={<Navigate to="/joe/alpha-hd" replace />} />
      <Route path="/joe/:pack" element={<JoeStudio />} />
      <Route path="/dragon" element={<DragonStudio />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
