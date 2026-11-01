import { useState } from 'react';

export const photos = {
  campus: { src: '/photos/bm-school-campus.png', alt: 'Boborahim Mashrab school building with blue-and-white balloons at the entrance' },
  community: { src: '/photos/bm-classroom-community.png', alt: 'Teacher holding flowers surrounded by students in a bright classroom' },
  lesson: { src: '/photos/bm-interactive-lesson.png', alt: 'Teacher explaining a lesson at an interactive board while students watch' },
  writing: { src: '/photos/bm-students-writing.png', alt: 'Students concentrating on written exercises in a sunlit classroom' },
};

export default function Photo({ photo, className = '', priority = false }: { photo: { src: string; alt: string }; className?: string; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return <div className={`school-photo ${className} ${loaded ? 'is-loaded' : ''}`}>
    <img src={photo.src} alt={photo.alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" onLoad={() => setLoaded(true)} />
  </div>;
}
