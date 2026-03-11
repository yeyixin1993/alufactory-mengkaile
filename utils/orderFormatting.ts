const EAST8_TIME_ZONE = 'Asia/Shanghai';
const EAST8_LOCALE = 'zh-CN';

type DateLike = Date | string | number | null | undefined;

const normalizeDate = (value: DateLike): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

const getEast8Parts = (value: DateLike) => {
  const date = normalizeDate(value);
  const formatter = new Intl.DateTimeFormat(EAST8_LOCALE, {
    timeZone: EAST8_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
};

export const formatEast8Date = (value: DateLike) => {
  const { year, month, day } = getEast8Parts(value);
  return `${year}-${month}-${day}`;
};

export const formatEast8DateTime = (value: DateLike) => {
  const { year, month, day, hour, minute, second } = getEast8Parts(value);
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

export const getEast8TimestampToken = (value: DateLike) => {
  const { year, month, day, hour, minute, second } = getEast8Parts(value);
  return `${year}${month}${day}_${hour}${minute}${second}`;
};

const sanitizeFilenamePart = (value: string, fallback: string) => {
  const cleaned = value
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^-+|-+$/g, '')
    .replace(/^_+|_+$/g, '');

  return cleaned || fallback;
};

interface OrderPdfFilenameOptions {
  createdAt?: DateLike;
  userName?: string;
  amount?: number;
  orderRef?: string;
  withPrice?: boolean;
}

export const buildOrderPdfFilename = ({
  createdAt,
  userName,
  amount,
  orderRef,
  withPrice,
}: OrderPdfFilenameOptions) => {
  const timestamp = getEast8TimestampToken(createdAt);
  const safeUserName = sanitizeFilenamePart(userName || 'guest', 'guest');
  const safeOrderRef = sanitizeFilenamePart(orderRef || 'ORDER', 'ORDER');
  const safeAmount = Number.isFinite(amount) ? Number(amount).toFixed(2) : '0.00';
  const priceMode = typeof withPrice === 'boolean' ? `_${withPrice ? '含价格' : '不含价格'}` : '';

  return `生产单_${timestamp}_用户_${safeUserName}_金额_${safeAmount}_${safeOrderRef}${priceMode}.pdf`;
};
