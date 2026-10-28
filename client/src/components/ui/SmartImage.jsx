import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { assetUrl } from '../../lib/api.js';

export const SmartImage = ({ src, alt = '', className = '', ...rest }) => {
  const [failed, setFailed] = useState(false);
  const resolved = assetUrl(src);

  if (!resolved || failed) {
    return (
      <div className={`img-fallback ${className}`} aria-hidden="true">
        <UtensilsCrossed size={22} />
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      {...rest}
    />
  );
};

export default SmartImage;
