export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(newToken) {
  localStorage.setItem('token', newToken);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export function getUser() {
  const storedToken = getToken();
  if (!storedToken) return null;
  try {
    const jwtPayload = JSON.parse(atob(storedToken.split('.')[1]));
    return jwtPayload; // { id, username, is_admin }
  } catch {
    return null;
  }
}
