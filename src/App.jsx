import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [clientes, setClientes] = useState([])

  useEffect(() => {
    cargarClientes()
  }, [])

  async function cargarClientes() {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')

    if (error) {
      console.error(error)
      return
    }

    setClientes(data || [])
  }

  return (
    <div style={{ padding: '40px' }}>
      <h1>Préstamos Keydi</h1>
      <p>Conectado a Supabase</p>

      <h2>Clientes registrados</h2>
      <pre>{JSON.stringify(clientes, null, 2)}</pre>
    </div>
  )
}