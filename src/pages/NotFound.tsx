import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container narrow empty-page">
      <h1>Page not found</h1>
      <p>
        That page doesn't exist (yet). <Link to="/">Go home</Link>
      </p>
    </div>
  );
}
