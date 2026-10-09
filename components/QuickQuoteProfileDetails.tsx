import React from 'react';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';
export default function QuickQuoteProfileDetails({meters,process,details,language='cn'}:{meters:{name:string;meters:number}[];process:{tapping:number;through:number;countersunk:number;threaded:number;miter45:number};details:{id:string;text:string}[];language?:Language}) {
 const t=TRANSLATIONS[language];
 return <div className="text-sm text-slate-700">
                    <div data-pdf-block className="font-bold text-slate-800">{t.qq_profileMetersByModelColor}</div>
                    <ul className="list-disc pl-5 mt-1 space-y-1 font-semibold text-slate-700">
                      {meters.map((x) => (
                        <li data-pdf-block key={x.name}>{x.name}: {x.meters.toFixed(1)} {t.qq_meter}</li>
                      ))}
                    </ul>
                    <ul className="list-disc pl-5 mt-2 space-y-1 font-semibold text-slate-700">
                      {process.tapping > 0 && <li>{t.qq_tappingCount}: {process.tapping}</li>}
                      {process.through > 0 && <li>{t.qq_throughHoleCount}: {process.through}</li>}
                      {process.countersunk > 0 && <li>{t.qq_countersunkCount}: {process.countersunk}</li>}
                      {process.threaded > 0 && <li>{t.qq_threadedHoleCount}: {process.threaded}</li>}
                      {process.miter45 > 0 && <li>{t.qq_miter45CutCount}: {process.miter45}</li>}
                    </ul>
                    {details.length > 0 && (
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-slate-500">
                        {details.map((x) => (
                          <li data-pdf-block key={`profile-detail-${x.id}`}>{x.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>;
}
