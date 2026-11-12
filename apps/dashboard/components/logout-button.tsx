export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button className="sidebar-logout" type="submit">
        Sign out
      </button>
    </form>
  );
}
