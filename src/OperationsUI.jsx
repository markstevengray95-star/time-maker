import React from 'react';
export function Panel({title,description,children}) {return <section className="panel"><h2>{title}</h2>{description && <p>{description}</p>}{children}</section>;}
export function Metrics({items}) {return <div className="summary-grid compact">{items.map(([label,value,note])=><div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div>;}
export function Table({head,rows}) {return <div className="table-scroll"><table className="ops-table"><thead><tr>{head.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table>{!rows.length && <p>No matching records.</p>}</div>;}
