import { Link } from '@tanstack/react-router'

export function AuthButton() {
  return (
    <Link to="/login" className="text-sm font-medium transition-colors hover:text-primary ">
      Login
    </Link>
  )
}
