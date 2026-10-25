import { Globe, Mail } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Dialog } from './ui/Dialog';
import { AUTHOR, BUILT_WITH, LICENSE_URL, RELEASE_NOTES_URL, REPOSITORY_URL } from '../appInfo';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** Who made Vectopix, its version and licence, and what it is built with. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog
      title={t('about.title')}
      onClose={onClose}
      className="about-dialog"
      footer={
        <>
          <a className="btn" href={REPOSITORY_URL} {...external}>
            {t('menu.source')}
          </a>
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            {t('prefs.done')}
          </button>
        </>
      }
    >
      <div className="about-identity">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={64} height={64} />
        <div>
          <h3 className="about-name">Vectopix</h3>
          <a className="about-version" href={RELEASE_NOTES_URL} {...external}>
            {t('about.version', { version: __APP_VERSION__ })}
          </a>
        </div>
      </div>
      <p className="about-tagline">{t('about.tagline')}</p>

      <section className="about-author" aria-label={t('about.createdBy')}>
        <span className="about-label">{t('about.createdBy')}</span>
        <strong>{AUTHOR.name}</strong>
        <a href={AUTHOR.website} {...external}>
          <Globe size={14} />
          {AUTHOR.website.replace(/^https:\/\//, '')}
        </a>
        <a href={`mailto:${AUTHOR.email}`} {...external}>
          <Mail size={14} />
          {AUTHOR.email}
        </a>
      </section>

      <p className="about-fineprint">
        <a href={LICENSE_URL} {...external}>
          {t('about.license')}
        </a>{' '}
        {t('about.builtWith')}{' '}
        {BUILT_WITH.map((lib, i) => (
          <span key={lib.name}>
            {i > 0 && ', '}
            <a href={lib.url} {...external}>
              {lib.name}
            </a>
          </span>
        ))}
        .
      </p>
    </Dialog>
  );
}
