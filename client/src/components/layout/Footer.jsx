import { Clock, Facebook, Instagram, Mail, MapPin, Phone, Twitter, UtensilsCrossed, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext.jsx';

export const Footer = () => {
  const { settings } = useSettings();

  const socials = [
    { url: settings.instagram_url, Icon: Instagram, label: 'Instagram' },
    { url: settings.facebook_url, Icon: Facebook, label: 'Facebook' },
    { url: settings.twitter_url, Icon: Twitter, label: 'Twitter' },
    { url: settings.youtube_url, Icon: Youtube, label: 'YouTube' },
  ].filter((item) => item.url);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="footer__brand">
              <span className="brand__mark">
                <UtensilsCrossed size={20} />
              </span>
              {settings.site_name}
            </div>
            <p className="footer__note">{settings.tagline}. Freshly cooked, tracked live, delivered hot.</p>
            <div className="footer__social">
              {socials.map(({ url, Icon, label }) => (
                <a key={label} href={url} target="_blank" rel="noreferrer" aria-label={label}>
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4>Explore</h4>
            <Link to="/restaurants">Restaurants</Link>
            <br />
            <Link to="/foods">Full menu</Link>
            <br />
            <Link to="/offers">Offers & coupons</Link>
            <br />
            <Link to="/orders">Track an order</Link>
          </div>

          <div>
            <h4>Account</h4>
            <Link to="/profile">My profile</Link>
            <br />
            <Link to="/favourites">Favourites</Link>
            <br />
            <Link to="/login">Sign in</Link>
            <br />
            <Link to="/register">Create account</Link>
          </div>

          <div>
            <h4>Reach us</h4>
            <p className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
              <MapPin size={15} style={{ marginTop: 5, flexShrink: 0 }} />
              {settings.company_address}
            </p>
            <p className="row" style={{ gap: 8 }}>
              <Phone size={15} /> {settings.support_phone}
            </p>
            <p className="row" style={{ gap: 8 }}>
              <Mail size={15} /> {settings.support_email}
            </p>
            <p className="row" style={{ gap: 8 }}>
              <Clock size={15} /> {settings.opening_hours}
            </p>
          </div>
        </div>

        <div className="footer__bottom">
          <span>
            © {new Date().getFullYear()} {settings.site_name}. Built with the MERN stack + MySQL.
          </span>
          <span>Made for hungry people in {settings.delivery_radius_km} km of Chennai.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
