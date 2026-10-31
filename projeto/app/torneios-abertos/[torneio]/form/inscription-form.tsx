'use client'

import { useActionState, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TournamentContext } from '@/lib/context'
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
import { verifyCbxId, verifyFideId } from './verify-player'

type IdKind = 'fide' | 'cbx'

type IdState = {
  value: string
  /** ID já conferido: confirmado por um site oficial ou liberado com aviso. */
  verifiedId: string
  player: OfficialPlayer | null
  error: string
  /** Aviso que não impede a inscrição (ex.: dados confirmados pela CBX). */
  warning: string
  /** Consulta em andamento. */
  loading: boolean
  /**
   * O site oficial não respondeu. Não é erro do jogador: a inscrição segue e o
   * árbitro confere o ID na análise, então o formulário não fica travado.
   */
  unconfirmed: boolean
}

const emptyIdState: IdState = {
  value: '',
  verifiedId: '',
  player: null,
  error: '',
  warning: '',
  loading: false,
  unconfirmed: false,
}

const AVISO_CONFIRMADO_PELA_CBX =
  '*FIDE indisponível: dados confirmados pelo cadastro da CBX. Gênero e rating serão conferidos pelo árbitro.'

/**
 * A FIDE recusa conexão vinda de IP de datacenter — é o caso da Vercel, e não
 * tem contorno do lado do servidor. Travar a inscrição por isso impede de se
 * inscrever justamente quem tem o ID correto, então o jogador segue com aviso e
 * o árbitro confere o número na análise (o envio já funcionava assim).
 */
const avisoSemConfirmacao = (site: string, motivo: string) =>
  `*A ${site} não respondeu agora${
    motivo ? ` (${motivo})` : ''
  }. A organização vai conferir este ID na análise.`

const idRules: Record<
  IdKind,
  { label: string; isValid: (id: string) => boolean; lookup: (id: string) => Promise<LookupResult> }
> = {
  fide: {
    label: 'FIDE',
    isValid: (id) => id.length === 7 || id.length === 8,
    lookup: verifyFideId,
  },
  cbx: {
    label: 'CBX',
    isValid: (id) => id.length >= 4 && id.length <= 6,
    lookup: verifyCbxId,
  },
}

const initialState: InscriptionState = { status: 'idle' }
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png']

/**
 * Situação da consulta logo abaixo do campo. Sem isso o formulário fica mudo
 * durante a consulta e o jogador não sabe se o ID foi aceito ou se travou.
 */
function StatusDoId({ state, onRetry }: { state: IdState; onRetry: () => void }) {
  if (state.loading) return <p className="obs">Carregando...</p>

  return (
    <>
      {state.error !== '' ? <p className="error">{state.error}</p> : ''}
      {state.warning !== '' ? (
        <p className="obs">
          {state.warning}
          {state.unconfirmed ? (
            <>
              {' '}
              <button
                type="button"
                onClick={onRetry}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                  color: 'inherit',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Tentar novamente
              </button>
            </>
          ) : (
            ''
          )}
        </p>
      ) : (
        ''
      )}
    </>
  )
}

export default function InscriptionForm() {
  const tournament = useContext(TournamentContext)
  const router = useRouter()

  const [state, formAction] = useActionState(submitInscription, initialState)

  // ---- Identificação (ID FIDE / CBX) ----
  const [hasIds, setHasIds] = useState(true)
  const [fide, setFide] = useState<IdState>(emptyIdState)
  const [cbx, setCbx] = useState<IdState>(emptyIdState)
  // Cada consulta recebe um número; respostas de consultas antigas são descartadas.
  const lookupTickets = useRef<Record<IdKind, number>>({ fide: 0, cbx: 0 })
  // Valores atuais dos dois campos: a conferência do ID FIDE pelo cadastro da
  // CBX precisa do resultado da outra consulta dentro do callback de atualização.
  const idsAtuais = useRef({ fide, cbx })
  useEffect(() => {
    idsAtuais.current = { fide, cbx }
  })

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
   * A CBX respondeu depois de a FIDE ter falhado: o perfil da CBX informa o ID
   * FIDE do jogador, então ele confirma o número digitado e o formulário libera.
   */
  function confirmarFidePelaCbx(jogadorCbx: OfficialPlayer) {
    const fideAtual = idsAtuais.current.fide

    // Só quando a consulta da FIDE já terminou sem confirmação. Se ela ainda
    // nem foi tentada (ou está em andamento), o jogador pode ter o dado
    // confirmado pelo próprio site da FIDE.
    const fideFalhou = fideAtual.unconfirmed || fideAtual.error !== ''

    if (fideAtual.value === '' || fideAtual.player !== null || fideAtual.loading) return
    if (!fideFalhou) return

    const confirmacao = confirmarIdFidePelaCbx(fideAtual.value, jogadorCbx)

    if (!confirmacao.ok) {
      // O cadastro da CBX aponta outro ID: isso é erro de digitação, e o aviso
      // ajuda mais que o erro genérico. Quando a CBX só não tem a informação,
      // o aviso que já está na tela continua valendo.
      if (!confirmacao.divergente) return

      setFide({
        ...fideAtual,
        error: `*Não foi possível consultar a FIDE agora. ${confirmacao.motivo}`,
        warning: '',
        unconfirmed: false,
      })
      return
    }

    setFide({
      value: fideAtual.value,
      verifiedId: fideAtual.value,
      player: confirmacao.player,
      error: '',
      warning: AVISO_CONFIRMADO_PELA_CBX,
      loading: false,
      unconfirmed: false,
    })
  }

  async function checkId(kind: IdKind, forcar = false) {
    const rule = idRules[kind]
    const current = kind === 'fide' ? fide : cbx
    const update = kind === 'fide' ? setFide : setCbx
    const id = current.value.trim()

    if (id === '' || current.loading) return

    // Já conferido: não repete a consulta a cada perda de foco. O botão
    // "Tentar novamente" chama com forcar = true.
    if (!forcar && current.verifiedId === id) return

    if (!rule.isValid(id)) {
      update((latest) => ({
        ...latest,
        verifiedId: '',
        player: null,
        error: '*Insira um ID válido',
        warning: '',
        loading: false,
        unconfirmed: false,
      }))
      return
    }

    const ticket = ++lookupTickets.current[kind]
    update((latest) => ({
      ...latest,
      verifiedId: '',
      player: null,
      error: '',
      warning: '',
      loading: true,
      unconfirmed: false,
    }))

    let result: LookupResult

    try {
      result = await consultarComPrazo(id, rule.lookup)
    } catch (error) {
      // Falha de transporte (função na Vercel interrompida, sem rede...) não pode
      // deixar o formulário travado: vira um aviso e o jogador pode tentar de novo.
      result = {
        status: 'unavailable',
        motivo: error instanceof Error ? error.message.slice(0, 120) : 'falha ao chamar o servidor',
      }
    }

    if (ticket !== lookupTickets.current[kind]) return

    if (kind === 'cbx' && result.status === 'found') confirmarFidePelaCbx(result.player)

    update((latest) => {
      // O jogador já mudou o campo enquanto a consulta acontecia.
      if (latest.value.trim() !== id) return latest

      if (result.status === 'found') {
        return {
          ...latest,
          verifiedId: id,
          player: result.player,
          error: '',
          warning: '',
          loading: false,
          unconfirmed: false,
        }
      }

      if (result.status === 'not-found') {
        return {
          ...latest,
          verifiedId: '',
          player: null,
          error: `*Usuário ${rule.label} não encontrado`,
          warning: '',
          loading: false,
          unconfirmed: false,
        }
      }

      // A FIDE não respondeu: se o cadastro da CBX confirma o ID digitado, a
      // inscrição segue com os dados dela em vez de ficar presa.
      if (kind === 'fide') {
        const jogadorCbx = idsAtuais.current.cbx.player
        const confirmacao = jogadorCbx ? confirmarIdFidePelaCbx(id, jogadorCbx) : null

        if (confirmacao?.ok) {
          return {
            value: id,
            verifiedId: id,
            player: confirmacao.player,
            error: '',
            warning: AVISO_CONFIRMADO_PELA_CBX,
            loading: false,
            unconfirmed: false,
          }
        }

        if (confirmacao?.divergente) {
          return {
            ...latest,
            verifiedId: '',
            player: null,
            warning: '',
            loading: false,
            unconfirmed: false,
            error: `*Não foi possível consultar a FIDE agora${
              result.motivo ? ` (${result.motivo})` : ''
            }. ${confirmacao.motivo}`,
          }
        }
      }

      // Nenhum site oficial confirmou. O motivo vem do servidor para o jogador
      // (e o suporte) saber se o site recusou, demorou ou está fora do ar.
      return {
        ...latest,
        verifiedId: id,
        player: null,
        error: '',
        warning: avisoSemConfirmacao(rule.label, result.motivo ?? ''),
        loading: false,
        unconfirmed: true,
      }
    })
  }

  /** Um ID digitado e já resolvido (confirmado nos sites oficiais ou liberado com aviso). */
  const idPreenchido = (state: IdState) =>
    state.value !== '' && state.error === '' && !state.loading
  const idsBlocked = hasIds && !(idPreenchido(fide) && idPreenchido(cbx))
  const consultando = hasIds && (fide.loading || cbx.loading)

  // ---- Conferência do nome / data / gênero com os dados oficiais ----
  const nameError = useMemo(() => {
    if (!playerCbx || !identityTouched) return ''
    if (name.trim() === '' || name.trim() === playerCbx.name.trim()) return ''

    return `*Nome incorreto, o nome fornecido no ID é: ${playerCbx.name}`
  }, [playerCbx, name, identityTouched])

  const infoError = useMemo(() => {
    if (!playerFide || !playerCbx || !identityTouched) return ''

    const dateMismatch = birthDate.trim() !== '' && birthDate.trim() !== playerCbx.bornYear.trim()
    const genreMismatch =
      playerFide.genre !== null && playerFide.genre !== (genre === 'masc' ? 'm' : 'f')

    if (!dateMismatch && !genreMismatch) return ''

    return `*Informações inválidas, as informações cadastradas são: ${playerCbx.bornYear} - ${
      playerFide.genre === 'm' ? 'Masculino' : 'Feminino'
    }`
  }, [playerFide, playerCbx, birthDate, genre, identityTouched])

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

  function handleReceiptChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]

    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowed = ALLOWED_EXTENSIONS.includes(extension)

    if (!allowed) event.currentTarget.value = ''

    setReceiptName(allowed ? file.name : '')
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
                onBlur={() => checkId('fide')}
                onKeyDown={handleEnterBlur}
              />
              <StatusDoId state={fide} onRetry={() => checkId('fide', true)} />
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
                onBlur={() => checkId('cbx')}
                onKeyDown={handleEnterBlur}
              />
              <StatusDoId state={cbx} onRetry={() => checkId('cbx', true)} />
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

        {idsBlocked ? (
          <p className="error">
            {consultando
              ? '*Consultando os sites oficiais, aguarde...'
              : '*Preencha os campos acima antes de continuar'}
          </p>
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
              <span style={{ fontSize: '10pt' }}>(.jpg / .jpeg / .png)</span>
            </button>
            {receiptName !== '' ? <p>({receiptName})</p> : ''}
            <input
              ref={receiptInput}
              onChange={handleReceiptChange}
              type="file"
              id="input-comprovante"
              name="fileComprovante"
              accept=".jpg,.jpeg,.png"
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
