const DefaultEnv = {
  APP_URL: 'http://localhost:3000',

  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GOOGLE_CLIENT_REDIRECT_URI: '',

  JWT_SECRET: 'default_jwt_secret',
};

export const Env = {
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  APP_URL: process.env.APP_URL || DefaultEnv.APP_URL,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || DefaultEnv.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || DefaultEnv.GOOGLE_CLIENT_SECRET,
  GOOGLE_CLIENT_REDIRECT_URI: process.env.GOOGLE_CLIENT_REDIRECT_URI || DefaultEnv.GOOGLE_CLIENT_REDIRECT_URI,

  JWT_SECRET: process.env.JWT_SECRET || DefaultEnv.JWT_SECRET,
};

type CheckLevel = 'empty' | 'default';
type CheckOptions = {
  error?: CheckLevel;
  warn?: CheckLevel;
}
const check = (key: keyof typeof Env, {
  error,
  warn = 'default',
}: CheckOptions = {}) => {
  if ((error === 'empty' || error === 'default') && !Env[key]) throw new Error(`"${key}" is required but is not set.`);
  if (error === 'default' && Env[key] === DefaultEnv[key as keyof typeof DefaultEnv]) {
    throw new Error(`"${key}" is using the default value, which is not allowed.`);
  }

  if ((warn === 'empty' || warn === 'default') && !Env[key]) {
    console.warn(`"${key}" is not set.`);
  }
  if (warn === 'default' && Env[key] === DefaultEnv[key as keyof typeof DefaultEnv]) {
    console.warn(`"${key}" is using the default value: "${DefaultEnv[key as keyof typeof DefaultEnv]}"`);
  }
};

check('APP_URL', { error: Env.IS_PRODUCTION ? 'default' : undefined });
check('GOOGLE_CLIENT_ID', { error: 'default' });
check('GOOGLE_CLIENT_SECRET', { error: 'default' });
check('GOOGLE_CLIENT_REDIRECT_URI', { error: 'default' });
check('JWT_SECRET', { error: Env.IS_PRODUCTION ? 'default' : undefined });
