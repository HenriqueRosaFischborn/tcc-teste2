'use client'


import {useActionState, useContext, useEffect, useState } from "react";
import Fields from "./fields";
import actionInscriIndividual from "./action";
import Form from "next/form";
import { FormState } from "@/lib/types";
import { TournamentContext } from "@/lib/context";
import { validarComprovante } from "@/lib/comprovante";
import { verifyCbxId, verifyFideId } from "@/app/torneios-abertos/[torneio]/form/verify-player";
import type { LookupResult, OfficialPlayer } from "@/app/torneios-abertos/[torneio]/form/types";
import { consultarComPrazo, handleEnterBlur } from "@/app/torneios-abertos/[torneio]/form/utils";

/**
 * Chama a consulta oficial sem deixar a tela travada: falha de transporte
 * (função na Vercel interrompida, sem rede) vira um aviso, não um formulário
 * carregando para sempre.
 */
async function consultar(
    buscar: (id: string) => Promise<LookupResult>,
    id: string
): Promise<LookupResult> {
    try {
        return await consultarComPrazo(id, buscar)
    } catch (error) {
        return {
            status: 'unavailable',
            motivo: error instanceof Error ? error.message.slice(0, 120) : 'falha ao chamar o servidor',
        }
    }
}

export default function FormEditInscriIndividual() {

    const initialValue: FormState= {}
   
    const [state, formAction] = useActionState(actionInscriIndividual, initialValue)
    const [button, setUButton] = useState<Boolean>(false)
    const [comprovante, setComprovante] = useState<string>('')

    function uploadFile(file: File) {
        const fileName = String(file.name.split('\\').at(-1))
        const input = document.getElementById('input-comprovante') as HTMLInputElement | null
        const validacao = validarComprovante(file)

        if (!validacao.ok) {
            if (input) input.value = ''
            setComprovante('')
            alert(validacao.motivo)
        } else {
            setComprovante(fileName)
        }

        const nome = document.getElementById('nome')

        if (nome && input) {
            nome.focus()
            nome.blur()
            input.focus()
        }
    }
   

    const [price, setPrice] = useState<Number>(0)

    function setVPrice(price: Number) {
        setPrice(price)
    }

    function setButton(isComplete: Boolean) {
        setUButton(isComplete)
    }
    
    useEffect(() => {
        if (state.message && state.values && state.message.includes('error-info-id')) {
            const p = document.querySelector('.pErr')

            if (!(p instanceof HTMLElement)) return

            p.focus()
        }
    }, [state])

    const [qr, setQr] = useState<string>('')
    const [qrKey, setQrKey] = useState<string>('')
    useEffect(() => {
        async function loadQr() {
            

            const chave = String(document.getElementById('qr-key')?.innerText)
            const src = String(document.getElementById('qr-src')?.innerText)
            
            setQrKey(chave)
            setQr(src)
        } 
        loadQr()
    }, [])


    if (state.message && state.message.includes('Sucesso') && state.message[1].startsWith('/minhas-inscricoes/')) {
        window.location.href = state.message[1]
    }

    const [hasFide, setHasFide] = useState(true)
    const [idFide, setIdFide] = useState<string>('')
    const [idCbx, setIdCbx] = useState<string>('')
    const [errorIdFide, setErrorIdFide] = useState<string>('')
    const [errorIdCbx, setErrorIdCbx] = useState<string>('')
    const [playerFide, setPlayerFide] = useState<OfficialPlayer>()
    const [playerCbx, setPlayerCbx] = useState<OfficialPlayer>()
    /**
     * Motivo de a FIDE não ter respondido. A FIDE recusa conexão de IP de nuvem
     * (Vercel), e travar a edição por causa disso deixaria o jogador sem saída —
     * então a identidade segue sendo conferida pela CBX, que informa nome, data
     * de nascimento e o próprio ID FIDE.
     */
    const [fideIndisponivel, setFideIndisponivel] = useState<string>('')

    async function sendIds(input: HTMLInputElement) {
        const id = input.value.trim()
        const type = input.name === 'idfide' ? 'fide' : 'cbx'

        if (type === 'fide' && id != idFide) {
            setPlayerFide(undefined)
            setFideIndisponivel('')

            if (id.length !== 7 && id.length !== 8) {
                setErrorIdFide('*Insira um ID válido')
                setIdFide('')
                return
            }

            setErrorIdFide('')

            const resultado = await consultar(verifyFideId, id)

            if (resultado.status === 'not-found') {
                setPlayerFide(undefined)
                setErrorIdFide('*Usuário FIDE não encontrado')
                setIdFide('')
                return
            }

            if (resultado.status === 'unavailable') {
                setPlayerFide(undefined)
                setErrorIdFide('')
                setFideIndisponivel(resultado.motivo ?? 'sem resposta')
                // O ID fica sem confirmar para que sair do campo tente de novo.
                setIdFide('')
                return
            }

            setIdFide(id)
            setPlayerFide(resultado.player)
            setErrorIdFide('')
        }

        if (type === 'cbx' && id != idCbx) {
            setPlayerCbx(undefined)

            if (id.length < 4 || id.length > 6) {
                setErrorIdCbx('*Insira um ID válido')
                setIdCbx('')
                return
            }

            setErrorIdCbx('')

            const resultado = await consultar(verifyCbxId, id)

            if (resultado.status === 'not-found') {
                setPlayerCbx(undefined)
                setErrorIdCbx('*Usuário CBX não encontrado')
                setIdCbx('')
                return
            }

            if (resultado.status === 'unavailable') {
                setPlayerCbx(undefined)
                setErrorIdCbx(
                    `*Não foi possível consultar a CBX agora${
                        resultado.motivo ? ` (${resultado.motivo})` : ''
                    }. Tente novamente.`
                )
                setIdCbx('')
                return
            }

            setIdCbx(id)
            setPlayerCbx(resultado.player)
            setErrorIdCbx('')
        }
    }

    const id = useContext(TournamentContext)
    const inscricao = useContext(TournamentContext).inscricao

    if (!inscricao) return

    useEffect(() => {
        if (!inscricao.id_fide) {
            const element = Array.from(document.getElementsByName('hasFide'))[1]
            if (!(element instanceof HTMLInputElement)) return
            element.click()
        } else {
            const el1= document.getElementById('form-fide')
            const el2= document.getElementById('form-cbx')
            if (!(el1 instanceof HTMLInputElement && el2 instanceof HTMLInputElement)) return
            el1.focus()
            el1.blur()
            el2.focus()
            el2.blur()
        }
        
        const el1= document.getElementById('input-date')
        const el2= Array.from(document.getElementsByName('genre'))[1]
        
        if (!(el1 instanceof HTMLInputElement && el2 instanceof HTMLInputElement)) return
        console.log('genero:', inscricao.genre)
        if (inscricao.genre) {
           el1.focus()
           el1.blur()
           const x = document.getElementById('nome')
           window.scrollTo(0, 0)
        } else {
            console.log(el2)
            el2.click()
        }
        
    }, []);

    return (
        <>
                <div className="form">
                    
                    <Form action={formAction}>
                        {/* <p className="error">*Para checar sua informação, <a className='fide-link' href="https://ratings.fide.com/" target='_blank' >Clique aqui</a> </p> */}
                        <div style={{width: '100%'}} className="select-radios">
                            <div>
                                <input className="division-for" type='radio' defaultChecked name='hasFide' value={'true'} onChange={() => setHasFide(!hasFide)}/>
                                <label htmlFor="division-for">Possuo ID FIDE e ID CBX</label>
                            </div>
                            <div>
                                <input className="division-for" type='radio' name='hasFide' value={'false'} onChange={() => setHasFide(!hasFide)}/>
                                <label htmlFor="division-for">Não possuo ID FIDE e ID CBX</label>
                                <p className="obs obs-fide">*Se não possuir cadastro FIDE, selecione esta opção</p>
                            </div>
                        </div>
                        
                        {hasFide ? (<>
                            <div style={{width: 'calc(50% - 15px)'}}>
                                <label htmlFor="idfide">ID Fide: <p className="ast">*</p></label>
                                <input id="form-fide" type="text" name="idfide" defaultValue={idFide ? idFide : inscricao.id_fide} onKeyDown={handleEnterBlur} maxLength={8} inputMode="numeric"  onInput={(e) => {e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '')}} onBlur={(e) => sendIds(e.currentTarget)}/>
                                {errorIdFide != '' ? <p className="error">{errorIdFide}</p> : ''}
                                {fideIndisponivel != '' ? <p className="obs obs-fide">*A FIDE não respondeu ({fideIndisponivel}). A conferência segue pela CBX — o ID será reconferido pela organização.</p> : ''}
                            </div>
                            <input type="text" hidden name="playerFide" value={JSON.stringify(playerFide)}/>
                        
                            <div style={{width: 'calc(50% - 15px)'}}>
                                <label htmlFor="idcbx">ID CBX:<p className="ast">*</p></label>
                                <input id="form-cbx" type="text" name="idcbx" defaultValue={idCbx ? idCbx : inscricao.id_cbx} onKeyDown={handleEnterBlur} maxLength={8} inputMode="numeric" onInput={(e) => {e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '')}} onBlur={(e) => sendIds(e.currentTarget)}/>
                                {errorIdCbx != '' ? <p className="error">{errorIdCbx}</p> : ''}
                            </div> 
                            <input type="text" hidden name="playerCbx" value={JSON.stringify(playerCbx)}/>
                        </>): ''}
                        
                        {/* FIDE fora do ar não trava a edição: a CBX ainda confere
                            nome e data de nascimento. */}
                        {((hasFide && (!playerCbx || (!playerFide && fideIndisponivel == ''))) || (errorIdFide != '' || errorIdCbx != '')) ? (<>
                            <p className="error">*Preencha os campos acima antes de continuar</p>
                        </>): ''}


                        <div className={`form ${(hasFide && (!playerCbx || (!playerFide && fideIndisponivel == ''))) || (errorIdFide != '' || errorIdCbx != '') ? 'disableDiv' : ''}`} style={{width: '100%'}}>
                            <Fields inscricao={inscricao} id={id.id} playerCbx={playerCbx} playerFide={playerFide} hasFide={hasFide} setindividualPrice={setVPrice} state={state} setButton={setButton} />
                            
                            <div id="qr-div" >
                                <div>
                                    <h2>Efetuar pagamento e confirmar inscrição:</h2>
                                    <p>Escaneie o QR Code com sua conta bancária ou use a chave Pix e confirme sua inscrição</p>    
                                    <div id="qr-key">
                                        <p><strong>Ou copie o código:</strong></p>
                                        <div className="input">
                                            <p>{qrKey}</p>
                                            <img src="/icons/copy.png" alt="copy" onClick={() => {
                                                navigator.clipboard.writeText(String(qrKey))
                                                alert('Copiado para área de transferência...')
                                            }}/>
                                        </div>
                                    </div>
                                </div>

                                <img src={qr} alt="qrcode" />
                            </div>
                            
                            <div className='upload-file' style={{width: '100%'}}>
                                <button onClick={() => document.getElementById('input-comprovante')?.click()} type='button' className='button red'><img src="/icons/upload.png" alt="" id="uploadIcon" fetchPriority='low' loading='lazy' decoding='async'/> Atualizar comprovante <span style={{fontSize: '10pt'}}>(qualquer imagem)</span></button>
                                {comprovante != '' ? (
                                    <p>({comprovante})</p>
                                ) : ('')}
                                <input onChange={(e) => {
                                    const files = e.currentTarget.files?.[0]

                                    if (!files) return
                                    
                                    uploadFile(files)
                                }} type='file' id='input-comprovante' name='fileComprovante' accept='image/*' hidden={true}/>
                            </div>


                            <div id="final-button" className={price != 0 && button ? '' : 'disableDiv'}>

                                <h1 style={{marginBottom: '0px'}}>Valor total: {price == 0 ? '' : new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                }).format(Number(price))}</h1>

                                <input type="text" hidden name="uuid" value={inscricao.uuid}/>
                                
                                <button
                                    type="submit"
                                    className="button red big"
                                    style={{ textAlign: 'start' }}
                                    onClick={(e) => {
                                        if (!confirm("Tem certeza que deseja atualizar as informações? Sua inscrição voltará a ser pendente caso já tenha sido confirmada e o arbitro revisará novamente suas informações")) {
                                            e.preventDefault();
                                        }
                                    }}
                                >
                                    Atualizar informações
                                </button>                                
                                
                                {/* {state.message && state.values && state.message.includes('error-info-id') ? 
                                    <p className="error pErr">As informações preenchidas não correspondem às oficialmente cadastradas na FIDE <br />
                                    <p className="error">*Obs.: Preencha as informações (inclusive nome) exatamente como são demonstradas oficialmente na FIDE</p>
                                    <a href={`https://ratings.fide.com/profile/${state.values[0].idfide}`} target="_blank" className="fide-link">Ver meu perfil FIDE</a> </p> 
                                : ('') } */}
                                {state.message && state.values && state.message.includes('Você já está inscrito') ?
                                    <p className="error pErr">Este jogador já está inscrito neste torneio (mesmo ID FIDE ou CBX)</p>
                                : ('') }
                                {/* Recusas das regras de inscrição (T15/T17): categoria de
                                    outro torneio, gênero incompatível, idade fora da
                                    categoria. Sem isto a recusa não aparecia. */}
                                {state.message && state.values
                                    && !['Sucesso', 'erro', 'error-info-id'].includes(state.message[0])
                                    && !state.message.includes('Você já está inscrito') ? (
                                    <p className="error pErr">{state.message[0]}</p>
                                ) : ('') }
                            </div>
                        </div>
                    </Form>
                </div>
        </>
    )
}