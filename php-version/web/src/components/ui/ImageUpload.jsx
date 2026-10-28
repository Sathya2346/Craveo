import { ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import api, { getApiError } from '../../lib/api.js';
import { SmartImage } from './SmartImage.jsx';

export const ImageUpload = ({ value, onChange, hint = 'JPG, PNG or WEBP up to 5 MB' }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const pick = () => inputRef.current?.click();

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('That image is larger than 5 MB');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.post('/uploads/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(response.data.data.url);
    } catch (failure) {
      setError(getApiError(failure).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="upload-field">
        <div className="upload-preview">
          {value ? <SmartImage src={value} alt="Preview" /> : <ImagePlus size={20} />}
        </div>
        <div className="stack" style={{ gap: 8, flex: 1, minWidth: 180 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--outline btn--sm" onClick={pick} disabled={uploading}>
              {uploading ? <span className="spinner spinner--dark" /> : <UploadCloud size={14} />} {value ? 'Replace' : 'Upload'}
            </button>
            {value && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange('')}>
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
          <input
            className="input"
            value={value || ''}
            onChange={(event) => onChange(event.target.value)}
            placeholder="…or paste an image URL"
          />
          <span className="field__hint">{hint}</span>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={upload} />
      {error && <span className="field__error">{error}</span>}
    </div>
  );
};

export default ImageUpload;
