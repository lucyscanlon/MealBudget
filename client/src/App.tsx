import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import MealLibraryPage from './pages/MealLibraryPage';
import PlannerPage from './pages/PlannerPage';
import ShoppingListPage from './pages/ShoppingListPage';
import TodayPage from './pages/TodayPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/meals" element={<MealLibraryPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/shopping" element={<ShoppingListPage />} />
            <Route path="/today" element={<TodayPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
