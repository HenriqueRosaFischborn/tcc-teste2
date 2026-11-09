import Image from "next/image";
import './unique.css'
import './responsive-unique.css'
import { headers } from 'next/headers'
import { auth } from "@/auth";
import db from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase";


export default async function Home() {
  const headersList = await headers() // pega o header, que são informações do navegador
  const userAgent = headersList.get('user-agent') || '' //retorna uma string com as informações
  
  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent) // faz uma pesquisa na string de tudo que pode indicar ser mobile
  // usar o isMobile para chamar o número de torneios iniciais necessários, mudar essa diferenciação depois, atualmente se está usando display none pelo css 

  const dateNow = new Date()

  const tournments = await db.torneio.findMany({
        // where: {id: 1},
        include: {
        tempo_torneio_time_digitalTotempo: {
            select: {
                time: true,
                plus: true
            }
        },
        tempo_torneio_time_analogTotempo: {
            select: {
                time: true,
                plus: true
            }
        }
      },
      where: {
        inscri_closed_by_arbiter: {
          not: true
        },
        date_inscri: {
          gt: dateNow
        }
      }
    
    }
  )

  const supabaseAdmin = await getSupabaseAdmin()  

  const folders: {[key: string]: string} = {}

  for (let i = 0; i < tournments.length; i++) {
    const pathFolder = `folders/${tournments[i].id}`;

    const { data, error } = await supabaseAdmin.storage
      .from("publics")
      .list("folders");

    if (!error && data.some(file => file.name === String(tournments[i].id))) {
      const publicUrl = supabaseAdmin.storage
        .from("publics")
        .getPublicUrl(pathFolder)
        .data.publicUrl;

      folders[tournments[i].title.split(" ").join("~")] = publicUrl;
    }
  }

  function classifyTime(min: number, seg: number) {

      const total = min + seg

      if (total < 3) {
          return 'bullet'
      } else if (total < 10) {
          return 'blitz'
      } else if (total < 60) {
          return 'rapid'
      } else {
          return 'standard'
      }
  }

  const titulados = [
    {
      nome: 'Frank Becker',
      funcao: 'Presidente',
      titulo: 'Árbitro FIDE',
    },

    {
      nome: 'Leandro Ubialli ',
      funcao: 'Vice-Presidente',
      titulo: 'Candidato a Mestre Nacional',
    },

    {
      nome: 'Alexandre de Matos',
      titulo: 'Candidato a Mestre Nacional',
    },

    {
      nome: 'Eduardo da Silva Cardoso',
      titulo: 'Candidato a Mestre FIDE',
    },
  ]

  console.log(folders)

  return (
    <>
      <div id="herobar">
        <img src="/logo.png" alt="logo" fetchPriority='low' loading='lazy' decoding='async'/>
        <div>
          <h1 >"O xadrez é a ginástica da inteligência"</h1>
          <h2>- Johann Wolfgang</h2>
        </div>
      </div>
      
      
     
      <h1>Bem-vindo(a) ao <br/>Clube de Xadrez de Araranguá!</h1>
      <img style={{
        width: 'auto',
        height: '100px',
        objectFit: 'contain'
      }} src="/icons/second-logo.png" alt="comp2" fetchPriority='low' loading='lazy' decoding='async'/>
      
      <div id="tournaments">
        <h1>Torneios Abertos para Inscrição</h1>


        {tournments.length > 0 ? tournments.map((tournment, i) => {
          
              const dateInscri = tournment.date_inscri.toLocaleDateString('pt-BR')
              const timeInscri = tournment.date_inscri.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
              })
          
              const dateEvent = tournment.date_event.toLocaleDateString('pt-BR')
              const timeEvent = tournment.date_event.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
              })
          
              const times = {
                  digital: {
                      time: Number(tournment.tempo_torneio_time_digitalTotempo?.time),
                      plus: Number(tournment.tempo_torneio_time_digitalTotempo?.plus)
                  },
                  analog: {
                      time: Number(tournment.tempo_torneio_time_analogTotempo?.time),
                      plus: Number(tournment.tempo_torneio_time_analogTotempo?.plus)
                  }
              }
              const diference = times.digital.time + ' + ' + times.digital.plus != times.analog.time + ' + ' + times.analog.plus
          
              const classTime = classifyTime(times.digital.time, times.digital.plus)
              const classTime2 = classifyTime(times.analog.time, times.analog.plus)
          
          return(
          // i é o número de repetição do negócio
          <div className="tournament" key={i}>
            <div className="content">
              <h3>{tournment.title}</h3>
              <div className="informations">
                <p><span className="r">Data do encerramento das inscrições:</span> {dateInscri}</p>
                <p><span className="r">Data do evento:</span> {dateEvent}</p>
                <p>
                  <span>Tempo:</span> {diference ? (<>
                      Digital: {classTime.charAt(0).toUpperCase() + classTime.slice(1)} ({times.digital.time + ' + ' + times.digital.plus}) /
                      Analógico: {classTime2.charAt(0).toUpperCase() + classTime2.slice(1)} ({times.analog.time + ' + ' + times.analog.plus})
                  </>)
                      : `
                      ${classTime.charAt(0).toUpperCase() + classTime.slice(1)} (${times.digital.time + ' + ' + times.digital.plus})
                  `}
                  
                  &nbsp;&nbsp;&nbsp;
                  <span>Local: <a target='_blank' href={tournment.local_link ? tournment.local_link : '#'} className="link">{tournment.local}</a></span>
                </p>
              </div>
              <a href={`/torneios-abertos/${tournment.title.split(' ').join('~')}`} className="button blue">Inscreva-se</a>
            </div>
            {folders[tournment.title.split(' ').join('~')] ? (
              <img src={folders[tournment.title.split(' ').join('~')]} alt="torneio" fetchPriority='low' loading='lazy' decoding='async'/>
            ) : ('')}
          </div>
        )}) : (<>
          <p className="obs">Não há torneios abertos no momento</p>
        </>)}

          <div id="pbuttons">
            <a href="/torneios-abertos" className="button black big">Ver todos os torneios</a>
          </div>
      </div>
      
      <div id="founders">

        <h1>Membros titulados do CXA</h1>
        <h2>Os destaques que impulsionam nosso xadrez</h2>
        
        
        <div id="img-founders">
          {titulados.map((el, i) => (
            <div className="founder">
              <img key={i} src={`/images/founders/imagem${i + 4}.png`} alt="f" fetchPriority='low' loading='lazy' decoding='async'/>
              <div key={i} className="content">
                <h3>{el.nome}</h3>
                {el.funcao ? ( <p><span>{el.funcao}</span></p> ) : ''}
                <p>{el.titulo}</p>
              </div>
            </div>
          ))}
        </div>

      </div>

      <div id="history">
        <div id="img">
          <img src="/images/img-our-history.png" alt="" fetchPriority='low' loading='lazy' decoding='async'/>
        </div>
        
        <div id="p-content">
          <div>
            <h1>Nossa história</h1>
            
            <p>Fundado em 2024 por Frank Becker, Leandro Ubialli e Alexandre de Matos, o Clube de Xadrez de Araranguá nasceu com o propósito de incentivar a prática do xadrez, promover o desenvolvimento esportivo e fortalecer a comunidade enxadrística da região.</p>

            <p>Desde sua criação, o clube tem se dedicado à organização de torneios, atividades de ensino e encontros entre enxadristas de diferentes níveis e experiência. Atualmente, o clube possui quatro membros titulados: Frank Becker (Árbitro FIDE), Leandro Ubialli (Candidato a Mestre Nacional), Alexandre de Matos (Candidato a Mestre Nacional) e Eduardo da Silva Cardoso (Candidato a Mestre FIDE).</p>

            <p>Hoje, o Clube de Xadrez de Araranguá continua sendo um espaço de aprendizado, estratégia e amizade.</p>
          </div>
        </div>
      </div>

      <div id="origins">
        <h1>Momentos Marcantes do Clube</h1>
        <h2 style={{marginBottom: '20px'}} >Registros que contam quem somos</h2>

        <div className="track rigth" style={{marginBottom: '20px'}}>
          <div className="set">
            {Array.from({ length: 7 }).map((_, i) => (
              <img key={i} src={`/images/sliderTop/imagem${i + 5}.png`} alt="img2" fetchPriority='low' loading='lazy' decoding='async'/>
            ))}
          </div>

          <div className="set">
            {Array.from({ length: 7 }).map((_, i) => (
              <img key={i} src={`/images/sliderTop/imagem${i + 5}.png`} alt="img2" fetchPriority='low' loading='lazy' decoding='async'/>
            ))}
          </div>
        </div>


        <div style={{width: '100%', flexDirection: 'column', alignItems: 'end'}}>

          <div className="track left">
            <div className="set">
              {Array.from({ length: 7 }).map((_, i) => (
                <img key={i} src={`/images/sliderBottom/imagem${i + 12}.png`} alt="img2" fetchPriority='low' loading='lazy' decoding='async'/>
              ))}
            </div>

            <div className="set">
              {Array.from({ length: 7 }).map((_, i) => (
                <img key={i} src={`/images/sliderBottom/imagem${i + 12}.png`} alt="img2" fetchPriority='low' loading='lazy' decoding='async'/>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
