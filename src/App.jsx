import { Navigate, Route, Routes } from 'react-router-dom'
import { BrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import Alertas from './pages/Alertas'
import Avales from './pages/Avales'
import Clientes from './pages/Clientes'
import Configuracion from './pages/Configuracion'
import ContratoPagare from './pages/ContratoPagare'
import Cuotas from './pages/Cuotas'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Pagos from './pages/Pagos'
import Prestamos from './pages/Prestamos'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Login />} path="/login" />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route element={<Dashboard />} index />
            <Route element={<Clientes />} path="/clientes" />
            <Route element={<Avales />} path="/avales" />
            <Route element={<Prestamos />} path="/prestamos" />
            <Route element={<Cuotas />} path="/cuotas" />
            <Route element={<Pagos />} path="/pagos" />
            <Route element={<Alertas />} path="/alertas" />
            <Route element={<Configuracion />} path="/configuracion" />
            <Route element={<ContratoPagare />} path="/contrato-pagare" />
          </Route>
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
