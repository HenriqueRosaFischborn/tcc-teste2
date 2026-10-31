'use client'

import { useActionState, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TournamentContext } from '@/lib/context'
import { validarComprovante } from '@/lib/comprovante'
import PlayerFields from './player-fields'
import { selectCategory } from './select-category'
import { submitInscription } from './submit-inscription'
import type {
  CategoryStatus,
  Genre,
  InscriptionState,
  LookupResult,
  OfficialPlayer,
} from './types'
import { formatCurrency, consultarComPrazo, handleEnterBlur } from './utils'
import { confirmarIdFidePelaCbx } from './confirmacao-cbx'
import { verifyCbxId } from './verify-player'

type IdKind = 'fide' | 'cbx'

type IdState = {
  value: string
  /** ID já conferido. */
  verifiedId: string
  player: OfficialPlayer | null
  error: string
  /** Consulta em andamento. */
  loading: boolean
}

const emptyIdState: IdState = {
  value: '',
  verifiedId: '',
  player: null,
  error: '',
  loading: false,
}

/**
 * O ID FIDE é conferido pelo cadastro da CBX, que informa o número — a FIDE não
 * responde requisição vinda de IP de datacenter (é o caso da Vercel), então
 * consultá-la só fazia o jogador esperar por uma resposta que nunca chega.
 */
const idRules: Record<IdKind, { isValid: (id: string) => boolean }> = {
  fide: { isValid: (id) => id.length === 7 || id.length === 8 },
  cbx: { isValid: (id) => id.length >= 4 && id.length <= 6 },
}

const initialState: InscriptionState = { status: 'idle' }

export default function InscriptionForm() {
  const tournament = useContext(TournamentContext)
  const router = useRouter()

  const [state, formAction] = useActionState(submitInscription, initialState)

  // ---- Identificação (ID FIDE / CBX) ----
  const [hasIds, setHasIds] = useState(true)
  const [fide, setFide] = useState<IdState>(emptyIdState)
  const [cbx, setCbx] = useState<IdState>(emptyIdState)
  // Cada consulta recebe um número; respostas de consultas antigas são descartadas.
  const consultaAtual = useRef(0)

  // ---- Dados do jogador ----
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [genre, setGenre] = useState<Genre>('masc')
  const [identityTouched, setIdentityTouched] = useState(false)
  const [divisionChoice, setDivisionChoice] = useState<'default' | 'absolute'>('default')
  const [receiptName, setReceiptName] = useState('')
  const receiptInput = useRef<HTMLInputElement | null>(null)

  const playerFide = hasIds ? fide.player : null
  const playerCbx = hasIds ? cbx.player : null

  function handleIdChange(kind: IdKind, value: string) {
    const digits = value.replace(/\D/g, '')
    const update = kind === 'fide' ? setFide : setCbx

    update((current) =>
      digits === current.verifiedId
        ? { ...current, value: digits }
        : { ...emptyIdState, value: digits }
    )
  }

  /**
   * Confere o ID FIDE digitado com o cadastro da CBX, que informa o número.
   * É a única verificação do campo FIDE: a consulta direta à FIDE não passa de
   * IP de datacenter (é o caso da Vercel), então tentá-la só fazia o jogador
   * esperar por uma resposta que nunca chega.
   */
  function conferirFidePelaCbx(
    estado: IdState,
    id: string,
    jogadorCbx: OfficialPlayer | null
  ): IdState {
    // Sem o cadastro da CBX não há com o que comparar: o número é conferido de
    // novo assim que a consulta da CBX terminar.
    if (!jogadorCbx) return { ...estado, verifiedId: id, player: null, error: '', loading: false }

    const confirmacao = confirmarIdFidePelaCbx(id, jogadorCbx)

    // O cadastro da CBX aponta outro número: é erro de digitação.
    if (!confirmacao.ok && confirmacao.divergente) {
      return { ...estado, verifiedId: '', player: null, error: `*${confirmacao.motivo}`, loading: false }
    }

    return {
      ...estado,
      verifiedId: id,
      player: confirmacao.ok ? confirmacao.player : null,
      error: '',
      loading: false,
    }
  }

  function checkFideId() {
    const id = fide.value.trim()

    if (id === '' || fide.verifiedId === id) return

    if (!idRules.fide.isValid(id)) {
      setFide({ ...fide, verifiedId: '', player: null, error: '*Insira um ID válido', loading: false })
      return
    }

    setFide(conferirFidePelaCbx(fide, id, cbx.player))
  }

  async function checkCbxId() {
    const id = cbx.value.trim()

    if (id === '' || cbx.loading || cbx.verifiedId === id) return

    if (!idRules.cbx.isValid(id)) {
      setCbx({ ...cbx, verifiedId: '', player: null, error: '*Insira um ID válido', loading: false })
      return
    }

    const ticket = ++consultaAtual.current

    setCbx({ ...cbx, verifiedId: '', player: null, error: '', loading: true })

    let result: LookupResult

    try {
      result = await consultarComPrazo(id, verifyCbxId)
    } catch (error) {
      // Falha de transporte (função na Vercel interrompida, sem rede...) não pode
      // deixar o formulário travado: vira um aviso e o jogador pode tentar de novo.
      result = {
        status: 'unavailable',
        motivo: error instanceof Error ? error.message.slice(0, 120) : 'falha ao chamar o servidor',
      }
    }

    if (ticket !== consultaAtual.current) return

    const jogadorCbx = result.status === 'found' ? result.player : null

    let erro = ''

    if (result.status === 'not-found') {
      erro = '*Usuário CBX não encontrado'
    } else if (result.status === 'unavailable') {
      erro = `*Não foi possível consultar a CBX agora${
        result.motivo ? ` (${result.motivo})` : ''
      }. Tente novamente.`
    }

    // Com o cadastro da CBX em mãos dá para conferir o ID FIDE digitado antes.
    if (jogadorCbx) {
      setFide((latest) =>
        latest.value.trim() === ''
          ? latest
          : conferirFidePelaCbx(latest, latest.value.trim(), jogadorCbx)
      )
    }

    setCbx((latest) => {
      // O jogador já mudou o campo enquanto a consulta acontecia.
      if (latest.value.trim() !== id) return latest

      return {
        ...latest,
        verifiedId: jogadorCbx ? id : '',
        player: jogadorCbx,
        error: erro,
        loading: false,
      }
    })
  }

  /** Um ID digitado e já resolvido. */
  const idPreenchido = (state: IdState) =>
    state.value !== '' && state.error === '' && !state.loading
  const idsBlocked = hasIds && !(idPreenchido(fide) && idPreenchido(cbx))
  const consultando = hasIds && (fide.loading || cbx.loading)

  // ---- Conferência do nome / data de nascimento com o cadastro da CBX ----
  const nameError = useMemo(() => {
    if (!playerCbx || !identityTouched) return ''
    if (name.trim() === '' || name.trim() === playerCbx.name.trim()) return ''

    return `*Nome incorreto, o nome fornecido no ID é: ${playerCbx.name}`
  }, [playerCbx, name, identityTouched])

  // O cadastro da CBX não informa gênero, então o que dá para conferir é a data.
  // Gênero e rating ficam para a análise do árbitro.
  const infoError = useMemo(() => {
    if (!playerCbx || !identityTouched) return ''
    if (birthDate.trim() === '' || birthDate.trim() === playerCbx.bornYear.trim()) return ''

    return `*Data de nascimento incorreta, a cadastrada é: ${playerCbx.bornYear}`
  }, [playerCbx, birthDate, identityTouched])

  // ---- Categoria (definida pela data de nascimento e pelo gênero) ----
  // As categorias e divisões chegam prontas do servidor junto com o torneio,
  // então a escolha é uma conta local: aparece na hora, sem consulta ao servidor.
  const dateComplete = birthDate.trim().length === 10

  const categoryResult = useMemo(
    () =>
      dateComplete
        ? selectCategory(tournament.categories ?? [], tournament.divisions ?? [], birthDate, genre)
        : null,
    [dateComplete, tournament.categories, tournament.divisions, birthDate, genre]
  )

  const categoryStatus: CategoryStatus = categoryResult === null ? 'idle' : categoryResult.status
  const category = categoryResult?.status === 'found' ? categoryResult.category : null
  const price = category?.price ?? 0

  // ---- Envio ----
  const fieldsComplete = name.trim() !== '' && dateComplete
  const identityOk = !hasIds || (nameError === '' && infoError === '')
  const canSubmit = price !== 0 && fieldsComplete && identityOk && receiptName !== ''
  const showCategory =
    dateComplete && categoryStatus === 'found' && (!hasIds || infoError === '')

  useEffect(() => {
    if (state.status === 'success') router.replace('/minhas-inscricoes')
  }, [state.status, router])

  // A mesma conferência do servidor (`lib/comprovante.ts`), feita antes de
  // enviar para avisar o jogador na hora em que ele escolhe o arquivo.
  function handleReceiptChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]

    if (!file) return

    const validacao = validarComprovante(file)

    if (!validacao.ok) {
      event.currentTarget.value = ''
      setReceiptName('')
      alert(validacao.motivo)
      return
    }

    setReceiptName(file.name)
  }

  async function copyPixKey() {
    try {
      await navigator.clipboard.writeText(String(tournament.pixKey))
      alert('Copiado para área de transferência...')
    } catch {
      // Navegador sem permissão de área de transferência: o código continua visível na tela.
    }
  }

  return (
    <div className="form">
      <form
        action={formAction}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault()
        }}
      >
        <div style={{ width: '100%' }} className="select-radios">
          <div>
            <input
              className="division-for"
              id="possui-ids"
              type="radio"
              name="hasFide"
              value="true"
              checked={hasIds}
              onChange={() => setHasIds(true)}
            />
            <label htmlFor="possui-ids">Possuo ID FIDE e ID CBX</label>
          </div>
          <div>
            <input
              className="division-for"
              id="nao-possui-ids"
              type="radio"
              name="hasFide"
              value="false"
              checked={!hasIds}
              onChange={() => setHasIds(false)}
            />
            <label htmlFor="nao-possui-ids">Não possuo ID FIDE e ID CBX</label>
            <p className="obs obs-fide">*Se não possuir cadastro FIDE, selecione esta opção</p>
          </div>
        </div>

        {hasIds ? (
          <>
            <div style={{ width: 'calc(50% - 15px)' }}>
              <label htmlFor="form-fide">ID Fide: <p className="ast">*</p></label>
              <input
                id="form-fide"
                type="text"
                name="idfide"
                value={fide.value}
                maxLength={8}
                inputMode="numeric"
                onChange={(event) => handleIdChange('fide', event.currentTarget.value)}
                onBlur={checkFideId}
                onKeyDown={handleEnterBlur}
              />
              {fide.error !== '' ? <p className="error">{fide.error}</p> : ''}
            </div>
            <input
              type="text"
              hidden
              name="playerFide"
              value={playerFide ? JSON.stringify(playerFide) : ''}
              readOnly
            />

            <div style={{ width: 'calc(50% - 15px)' }}>
              <label htmlFor="form-cbx">ID CBX:<p className="ast">*</p></label>
              <input
                id="form-cbx"
                type="text"
                name="idcbx"
                value={cbx.value}
                maxLength={8}
                inputMode="numeric"
                onChange={(event) => handleIdChange('cbx', event.currentTarget.value)}
                onBlur={checkCbxId}
                onKeyDown={handleEnterBlur}
              />
              {cbx.error !== '' ? <p className="error">{cbx.error}</p> : ''}
            </div>
            <input
              type="text"
              hidden
              name="playerCbx"
              value={playerCbx ? JSON.stringify(playerCbx) : ''}
              readOnly
            />
          </>
        ) : (
          ''
        )}

        {consultando ? <p className="obs">Carregando...</p> : ''}

        {idsBlocked && !consultando ? (
          <p className="error">*Preencha os campos acima antes de continuar</p>
        ) : (
          ''
        )}

        <div className={`form ${idsBlocked ? 'disableDiv' : ''}`} style={{ width: '100%' }}>
          <PlayerFields
            hasIds={hasIds}
            name={name}
            onNameChange={setName}
            onFieldBlur={() => setIdentityTouched(true)}
            nameError={nameError}
            onBirthDateChange={setBirthDate}
            genre={genre}
            onGenreChange={setGenre}
            infoError={infoError}
            categoryStatus={categoryStatus}
            category={category}
            showCategory={showCategory}
            divisionChoice={divisionChoice}
            onDivisionChange={setDivisionChoice}
          />

          {tournament.qrCodeUrl ? (
            <div id="qr-div">
              <div>
                <h2>Efetuar pagamento:</h2>
                <p>
                  Escaneie o QR Code com sua conta bancária ou use a chave Pix e confirme sua
                  inscrição
                </p>
                <div id="qr-key">
                  <p><strong>Ou copie o código:</strong></p>
                  <div className="input">
                    <p>{tournament.pixKey}</p>
                    <img src="/icons/copy.png" alt="copy" onClick={copyPixKey} />
                  </div>
                </div>
              </div>

              <img src={tournament.qrCodeUrl} alt="qrcode" />
            </div>
          ) : (
            ''
          )}

          <div className="upload-file" style={{ width: '100%' }}>
            <button
              onClick={() => receiptInput.current?.click()}
              type="button"
              className="button red"
            >
              <img
                src="/icons/upload.png"
                alt=""
                id="uploadIcon"
                fetchPriority="low"
                loading="lazy"
                decoding="async"
              />
              {' Anexar comprovante '}
            </button>
            {receiptName !== '' ? <p>({receiptName})</p> : ''}
            <input
              ref={receiptInput}
              onChange={handleReceiptChange}
              type="file"
              id="input-comprovante"
              name="fileComprovante"
              accept="image/*"
              hidden
            />
          </div>

          <div id="final-button" className={canSubmit ? '' : 'disableDiv'}>
            <h1 style={{ marginBottom: '0px' }}>
              Valor total: {price === 0 ? '' : formatCurrency(price)}
            </h1>

            <button type="submit" className="button red big" style={{ textAlign: 'start' }}>
              Solicitar inscrição
            </button>

            {state.status === 'duplicate' ? (
              <p className="error pErr">Este jogador já está inscrito neste torneio (mesmo ID FIDE ou CBX).</p>
            ) : (
              ''
            )}
            {state.status === 'error' ? <p className="error pErr">{state.message}</p> : ''}
          </div>
        </div>
      </form>
    </div>
  )
}
