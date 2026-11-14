// PaseListo event deep links and date-limited weather presentation helpers.
// These functions do not grant inventory, authorization or ticket sales.
export function eventDetailHref(id) {
 if (typeof id !== "string" || !id || id.length > 160) throw Error("ID de evento inválido");
 return "./evento.html?id=" + encodeURIComponent(id);
}

export function daysUntilEvent(eventDate, today) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return NaN;
 const start=Date.parse(today+"T12:00:00Z"),end=Date.parse(eventDate+"T12:00:00Z");
 return Math.round((end-start)/86400000);
}

export function forecastAvailable(eventDate, today, horizonDays=14) {
 const days=daysUntilEvent(eventDate,today);
 return Number.isSafeInteger(days) && days >= 0 && days < horizonDays;
}

export function weatherDescription(code) {
 if (code === 0) return "Despejado";
 if ([1,2].includes(code)) return "Parcialmente nublado";
 if (code === 3) return "Nublado";
 if ([45,48].includes(code)) return "Niebla";
 if ([51,53,55,56,57].includes(code)) return "Llovizna";
 if ([61,63,65,66,67,80,81,82].includes(code)) return "Lluvia";
 if ([71,73,75,77,85,86].includes(code)) return "Nieve";
 if ([95,96,99].includes(code)) return "Tormentas";
 return "Condiciones variables";
}
