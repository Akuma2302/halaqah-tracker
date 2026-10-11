import { Instagram, MessageCircle, Music2 } from 'lucide-react';

const SERVICES = [
  { key: 'whatsappUrl', label: 'WhatsApp', icon: MessageCircle, tone: 'whatsapp' },
  { key: 'instagramUrl', label: 'Instagram', icon: Instagram, tone: 'instagram' },
  { key: 'tiktokUrl', label: 'TikTok', icon: Music2, tone: 'tiktok' }
];

// Round buttons to a person's WhatsApp, Instagram and TikTok; nothing when
// they haven't added any. Only https links are ever rendered.
export default function SocialLinks({ person, labels = false }) {
  const links = SERVICES.filter((s) => /^https:\/\//.test(person?.[s.key] || ''));
  if (!links.length) return null;
  return (
    <span className={`social-links${labels ? ' with-labels' : ''}`}>
      {links.map(({ key, label, icon: Icon, tone }) => (
        <a
          key={key}
          href={person[key]}
          target="_blank"
          rel="noopener noreferrer"
          className={`social-link tone-${tone}`}
          aria-label={`${label}${person.name ? ` of ${person.name}` : ''}`}
          title={label}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon size={15} />
          {labels && <span>{label}</span>}
        </a>
      ))}
    </span>
  );
}
