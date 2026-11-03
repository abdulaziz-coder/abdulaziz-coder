import { useState } from 'react';
import { useLanguage } from './i18n';

export const photos = {
  primary: { src: '/photos/cambridge-primary-classroom.png', alt: 'Children raising their hands during a classroom lesson' },
  lower: { src: '/photos/cambridge-lower.jpg', alt: 'Students taking part in a classroom discussion' },
  upper: { src: '/photos/cambridge-upper-classroom.png', alt: 'Teacher guiding secondary students through a group classroom activity' },
  advanced: { src: '/photos/cambridge-advanced-classroom.png', alt: 'Students attending a lesson in a bright classroom' },

  campus: { src: '/photos/bm-school-campus.png', alt: 'Boborahim Mashrab school building with blue-and-white balloons at the entrance' },
  community: { src: '/photos/learning-materials.jpg', alt: 'Books, pencils, and an apple arranged on a learning desk' },
  lesson: { src: '/photos/classroom-hero.jpg', alt: 'Students listening to their teacher in a classroom' },
  writing: { src: '/photos/library.jpg', alt: 'A student exploring shelves of books in a library' },
};

export default function Photo({ photo, className = '', priority = false }: { photo: { src: string; alt: string }; className?: string; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const { t } = useLanguage();
  return <div className={`school-photo ${className} ${loaded ? 'is-loaded' : ''}`}>
    <img src={photo.src} alt={t(photo.alt)} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" onLoad={() => setLoaded(true)} />
  </div>;
}
