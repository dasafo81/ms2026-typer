import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PlayerProvider } from './hooks/usePlayer'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import LeaderboardPage from './pages/LeaderboardPage'
import MatchesPage from './pages/MatchesPage'
import MyPredictionsPage from './pages/MyPredictionsPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <PlayerProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<LeaderboardPage />} />
            <Route path="mecze" element={<MatchesPage />} />
            <Route path="moje-typy" element={<MyPredictionsPage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </PlayerProvider>
  )
}
