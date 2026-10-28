import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export const NotFound = () => (
  <div className="container page">
    <div className="empty-state" style={{ padding: '80px 20px' }}>
      <div className="empty-state__icon">
        <Compass size={28} />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>This page went out for delivery</h3>
      <p>We could not find what you were looking for. The menu is still warm though.</p>
      <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
        <Link to="/" className="btn">
          Back home
        </Link>
        <Link to="/foods" className="btn btn--outline">
          Browse the menu
        </Link>
      </div>
    </div>
  </div>
);

export default NotFound;
