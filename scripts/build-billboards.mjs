import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import projects from '../src/javascript/World/Sections/projectCatalog.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ink = '#172334'
const esc = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const text = (x, y, value, size = 30, fill = ink, extra = '') => `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="900" fill="${fill}" ${extra}>${esc(value)}</text>`

function illustration(project, frame)
{
    const a = project.accent
    const b = project.secondary
    const common = `stroke="${ink}" stroke-width="9" stroke-linejoin="round"`
    const sparkle = `<path d="M1020 142v70m-35-35h70M748 442v48m-24-24h48" stroke="${ink}" stroke-width="8"/>`
    let art = ''
    if(project.slug === 'zoan')
    {
        art = `<circle cx="906" cy="320" r="146" fill="${b}" ${common}/><g transform="rotate(${frame * 15 - 12} 906 320)"><path d="M791 217h221L805 421h221" fill="none" stroke="${ink}" stroke-width="58"/><path d="M776 202h221L790 406h221" fill="none" stroke="#fff6df" stroke-width="39"/></g><circle cx="1042" cy="461" r="49" fill="${ink}"/>${text(1011,476,'Z!',37,a)}`
    }
    if(project.slug === 'agent-lab')
    {
        art = `<ellipse cx="817" cy="333" rx="68" ry="155" fill="${ink}" stroke="${a}" stroke-width="22" transform="rotate(-16 817 333)"/><ellipse cx="1034" cy="285" rx="64" ry="147" fill="${ink}" stroke="${b}" stroke-width="22" transform="rotate(17 1034 285)"/><path d="M808 351Q936 474 1040 257" fill="none" stroke="#fff6df" stroke-width="10" stroke-dasharray="16 12"/><path d="M864 263l66-36 66 36v79l-66 38-66-38z" fill="#fff6df" ${common}/><path d="M864 263l66 38 66-38M930 301v79" fill="none" ${common}/><circle cx="930" cy="263" r="13" fill="${a}" stroke="${ink}" stroke-width="5"/>`
    }
    if(project.slug === 'deepseek')
    {
        art = `<rect x="744" y="198" width="349" height="240" rx="22" fill="${ink}"/><rect x="726" y="181" width="349" height="240" rx="22" fill="#fff6df" ${common}/><path d="M726 231h349" ${common}/><circle cx="753" cy="207" r="7" fill="${ink}"/><circle cx="778" cy="207" r="7" fill="${ink}"/><path d="M810 288l-33 28 33 28m77-56 33 28-33 28" fill="none" stroke="${ink}" stroke-width="13"/><path d="M842 342l17-58" stroke="${ink}" stroke-width="9"/><rect x="985" y="331" width="98" height="101" rx="12" fill="${b}" ${common}/><path d="M1009 331v-28m45 28v-28M1034 432v48" stroke="${ink}" stroke-width="10"/><path d="M859 427v52h116" fill="none" ${common}/>`
    }
    if(project.slug === 'agent-relay')
    {
        art = `<path d="M766 241h262v180H766z" fill="none" stroke="${ink}" stroke-width="8" stroke-dasharray="12 12"/><rect x="731" y="204" width="100" height="82" rx="19" fill="${b}" ${common}/><rect x="985" y="376" width="100" height="82" rx="19" fill="${b}" ${common}/><path d="M912 201l104 43v100c0 58-104 113-104 113s-104-55-104-113V244z" fill="#fff6df" ${common}/><path d="M863 320l36 36 72-82" fill="none" stroke="${ink}" stroke-width="19"/><circle cx="1033" cy="219" r="40" fill="${ink}"/>${text(1020,235,'!',47,a)}`
    }
    if(project.slug === 'lucid')
    {
        art = `<circle cx="919" cy="324" r="146" fill="${ink}"/><circle cx="901" cy="306" r="146" fill="${b}" ${common}/><path d="M957 184a120 120 0 1 0 83 180 126 126 0 0 1-83-180" fill="#fff6df" ${common}/>`
        for(let i = 0; i < 11; i++)
        {
            const h = 22 + Math.sin(i * .7 + frame) ** 2 * 94
            art += `<path d="M${763+i*28} ${445-h/2}v${h}" stroke="${ink}" stroke-width="13" stroke-linecap="round"/>`
        }
    }
    if(project.slug === 'aso-agent')
    {
        art = `<g transform="rotate(-9 893 320)"><rect x="773" y="164" width="222" height="332" rx="28" fill="#fff6df" ${common}/><path d="M846 190h77" stroke="${ink}" stroke-width="9" stroke-linecap="round"/><rect x="805" y="241" width="56" height="56" rx="12" fill="${a}" ${common}/><path d="M884 251h75m-75 29h60" stroke="${ink}" stroke-width="8"/><path d="M813 420v-64m51 64v-94m51 94V302" stroke="${ink}" stroke-width="24"/></g><circle cx="1010" cy="405" r="68" fill="${b}" ${common}/><path d="M976 405l24 24 43-53" fill="none" stroke="${ink}" stroke-width="13"/><path d="M1058 456l53 56" stroke="${ink}" stroke-width="23" stroke-linecap="round"/>`
    }
    return art + sparkle
}

for(const [index, project] of projects.entries())
{
    const dir = path.join(root, 'static/models/projects', project.slug)
    fs.mkdirSync(dir, { recursive: true })
    for(let frame = 0; frame < 3; frame++)
    {
        const lines = frame === 0 ? project.title : project.headlines[frame].split(' / ')
        const heading = lines.map((line, i) => text(64, 263 + i * 85, line, Math.min(76, 820 / line.length))).join('')
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
<title>${esc(project.name)} — ${esc(project.captions[frame])}</title>
<defs><pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2" fill="${ink}" opacity=".13"/></pattern></defs>
<rect width="1200" height="700" fill="${project.accent}"/>
<path d="M671 0h529v700H563z" fill="${project.secondary}"/><path d="M690 0h510v700H582z" fill="url(#dots)"/>
<rect x="18" y="18" width="1164" height="664" rx="6" fill="none" stroke="${ink}" stroke-width="8"/>
<rect x="52" y="49" width="281" height="49" rx="24" fill="${ink}"/>${text(76,82,`SELECTED WORK / 0${index+1}`,21,project.accent)}
${text(1140,84,`0${frame+1} — 03`,24,ink,'text-anchor="end"')}
${text(64,166,project.eyebrow.toUpperCase(),20)}${heading}
${text(64,421,frame === 0 ? project.headlines[0].replace(' / ',' ') : project.name.toUpperCase(),Math.min(25,1040/(frame===0?project.headlines[0].length:project.name.length)))}
${illustration(project,frame)}
<path d="M51 565h1098" stroke="${ink}" stroke-width="5"/>
${text(64,612,project.captions[frame],25)}${text(64,650,project.slug==='deepseek'?'EXPLORE THE REPOSITORY ↗':'STEP INSIDE THE PROJECT ↗',17)}
<circle cx="1100" cy="620" r="32" fill="${ink}"/><path d="M1087 633l27-27m-25 0h25v25" fill="none" stroke="${project.accent}" stroke-width="6"/>
</svg>`
        fs.writeFileSync(path.join(dir, `slide-${'abc'[frame]}.svg`), svg)
    }
}
console.log(`Generated ${projects.length * 3} illustrated project billboards.`)
