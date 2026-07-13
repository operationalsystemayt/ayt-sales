import { useAuthStore } from '../store/auth'

// Viewer role is read-only across the whole app — the backend also enforces this
// (RequireNotViewer blocks every non-GET route), this hook just keeps the UI in sync
// so viewers don't see controls that would 403 anyway.
export function useCanEdit() {
  const { user } = useAuthStore()
  return user?.role !== 'viewer'
}
