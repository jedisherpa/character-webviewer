import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Hub } from "./hub/Hub.jsx";
import { JoeStudio } from "./joe/JoeStudio.jsx";
import { DragonStudio } from "./dragon/DragonStudio.jsx";
import { ProductionStudio } from "./studio/ProductionStudio.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/studio" element={<ProductionStudio />} />
      <Route path="/joe" element={<Navigate to="/joe/alpha-hd" replace />} />
      <Route path="/joe/:pack" element={<JoeStudio />} />
      <Route path="/dragon" element={<DragonStudio />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
