import { useEffect, useState } from 'react';
import { readMedia } from '../services/mediaStore';

export default function useStoredMedia(id, remoteUrl = '') {
  const [value, setValue] = useState({ id: null, url: '', loading: false, error: '' });
  const safeRemote = /^https?:\/\//i.test(remoteUrl) ? remoteUrl : '';
  useEffect(() => {
    let cancelled = false, objectUrl = '';
    if (!id) { setValue({ id, url: safeRemote, loading: false, error: '' }); return; }
    setValue({ id, url: '', loading: true, error: '' });
    readMedia(id).then(record => {
      if (cancelled) return;
      if (!record) throw new Error('missing-file');
      objectUrl = URL.createObjectURL(record.blob);
      setValue({ id, url: objectUrl, record, loading: false, error: '' });
    }).catch(error => { if (!cancelled) setValue({ id, url: safeRemote, loading: false, error: safeRemote ? '' : error.message || 'storage' }); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, safeRemote]);
  return id && value.id !== id ? { url: '', loading: true, error: '' } : value;
}
