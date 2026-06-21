import {
  Bell,
  CalendarClock,
  CreditCard,
  FileText,
  HandCoins,
  LayoutDashboard,
  Settings,
  Users,
  UserCheck,
} from 'lucide-react'

export const navigation = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
  { icon: Users, label: 'Clientes', to: '/clientes' },
  { icon: UserCheck, label: 'Avales', to: '/avales' },
  { icon: HandCoins, label: 'Prestamos', to: '/prestamos' },
  { icon: CalendarClock, label: 'Cuotas', to: '/cuotas' },
  { icon: CreditCard, label: 'Pagos', to: '/pagos' },
  { icon: Bell, label: 'Alertas', to: '/alertas' },
  { icon: FileText, label: 'Contrato', to: '/contrato-pagare' },
  { icon: Settings, label: 'Configuracion', to: '/configuracion' },
]
