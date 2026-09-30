'use client';

import { useState, useEffect } from 'react';
import { getEstilistas } from '../services/api';

const DEFAULT_PHOTOS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDuPBlvq6n1v0Isk6me_xzRli1aDaCyE4cUx4ECNPZg7mlADdB94qIRdbe84-bx0X3O_EynyaeOVCOHUdJT1Lmwukc-rM5kvx7R94i_Wv_HGRbAk4KopfNd0Rk_CmwzusWqBEpmHG5hd93E0uQwFhiu85ViFO1JR_KC_5RfaaLhf1R5Z5bcriA77ieEaAypJpPk_ZILvRFGfKE8_SbLLKIzsBG4NPbI_4B3SpzTsClK2lXbDBum8YoFfa1gUFVpWF-V1fO1JVS2HmQ9",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAdmriGzWwZfCFhNaYVj0O8G5CQmddTL0OyzuYPt5LxVb4RnDRwZMJhWOIqg2hhjwbOAYDeIGL2pl2uUXNT1jSvNOVysn6BQP1ib1g6OCs1i0v9MpwhK0seCBOcXRmPf9nzcYhZCDj4Xb-ICwFhbcVnu_OmszrSpPhWEbH7MaiRf9x-ZtB91vRVM2M4UBC0BtQvuGKWZpEX0QIL_MJ28Z9030zbsNEnVD3Sri1yV447HyhW1OeAXrVKxmaa4w0fjVpfxc6Dwt1Nl1pg",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBMquZroNwEUEFaNYljxIQVxbypz3bBICOv5oJy0-wyS-6SWUIL-5qKQeHtG_88OnUGOKvMVELq4Cxw6lgy7LhPaJC0F2fgMTk4nepHY66L7xz37sdH-5afNhIAIKq_JSkvNi7X_G3xMYfh4A2o2ZR5StP5I7z887QY_5B118cYX6yelBzM4v_QsLwsORcLZ4P6cMDW9u0JIQII3hYKt35B4DDM3uvS0WWYEqy2CqJb3nTdjSpqr0vW7L80pj6dF7Ghas3yVFnv2u6s",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDVw9KyDkoisohmcXsVrpJeTIE9sbUSBTkeAP3Mc15_AaRlo1SA8lHXBZLvo6aHjvJgH4EQ-r7UExGrMUY4BHbNeFYJxxg_EikSxuir9aBRBLcxqeOEJKvRRTc4PwYltQ69zI3FsKUNtTBI_t60grbH7fKYXG1orXH4Pb2epHl6XEdsH7QLDq9C8oDKNEUKi-rZob0NEVK4kijjgYzpba-_HNjVNz85b4DBFHGZ59VT32iVg2c7QKV6if7cTpz1nyY-ToWtrLtb9FJv",
];

export default function TeamSection() {
  const [estilistas, setEstilistas] = useState([]);

  useEffect(() => {
    async function loadEstilistas() {
      const data = await getEstilistas();
      setEstilistas(data);
    }
    loadEstilistas();
  }, []);

  return (
    <section className="team-section" id="estilistas">
      <div className="team-container">
        <div className="team-header">
          <h2 className="team-title">Maestros de la Tijera</h2>
        </div>
        <div className="team-grid">
          {estilistas.map((member, index) => {
            const isOffset = index % 2 !== 0;
            const photo = member.foto_url || DEFAULT_PHOTOS[index % DEFAULT_PHOTOS.length];
            const name = `${member.nombre} ${member.apellido}`;
            return (
              <div key={member.id || index} className={`team-member ${isOffset ? 'offset-y' : ''}`}>
                <div className="member-img-wrapper">
                  <img className="member-img" alt={name} src={photo} />
                  <div className="member-img-overlay"></div>
                </div>
                <h3 className="member-name">{name}</h3>
                <p className="member-role">{member.especialidad}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
