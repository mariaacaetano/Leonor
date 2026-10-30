export type LocationData = {country:string, state:string, city:string};

export default function LocationFields({value, onChange}:{value:LocationData, onChange:(value:LocationData)=>void}) {
  return <div className="location-fields">
    <label>País<input name="country" autoComplete="country-name" maxLength={80} value={value.country} onChange={event=>onChange({...value,country:event.target.value})} placeholder="Ex.: Brasil"/></label>
    <div className="form-grid">
      <label>Estado ou região<input name="state" autoComplete="address-level1" maxLength={120} value={value.state} onChange={event=>onChange({...value,state:event.target.value})} placeholder="Ex.: São Paulo"/></label>
      <label>Cidade<input name="city" autoComplete="address-level2" maxLength={120} value={value.city} onChange={event=>onChange({...value,city:event.target.value})} placeholder="Ex.: Campinas"/></label>
    </div>
  </div>;
}
