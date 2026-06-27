import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, SafeAreaView, ScrollView, Share, StatusBar as NativeStatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
const colors = ["#b8755f", "#d9aaa0", "#c4937f", "#a98b7c", "#e0b9a8"];
const uid = () => `${Date.now()}-${Math.random()}`;
const peso = value => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value || 0));
const demo = { restaurant: "Luna Verde Ristorante", serviceCharge: 179, tax: 224.88, discount: 100, items: [
  { name: "Truffle Pasta", unitPrice: 520, quantity: 1 }, { name: "Margherita Pizza", unitPrice: 460, quantity: 1 },
  { name: "Garlic Bread", unitPrice: 70, quantity: 2 }, { name: "Caesar Salad", unitPrice: 220, quantity: 1 }
] };

function Button({ children, onPress, secondary, disabled }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && { opacity: .75 }]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{children}</Text></Pressable>;
}

export default function App() {
  const [welcomed, setWelcomed] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState(null);
  const [restaurant, setRestaurant] = useState("");
  const [items, setItems] = useState([]);
  const [fees, setFees] = useState({ serviceCharge: 0, tax: 0, discount: 0 });
  const [people, setPeople] = useState([]);
  const [newName, setNewName] = useState("");

  const loadReceipt = data => {
    setRestaurant(data.restaurant || "Restaurant");
    setItems((data.items || []).map(x => ({ id: uid(), name: x.name, price: Number(x.unitPrice), quantity: Number(x.quantity || 1), owners: [], shared: false })));
    setFees({ serviceCharge: Number(data.serviceCharge || 0), tax: Number(data.tax || 0), discount: Number(data.discount || 0) });
    setStep(1);
  };

  const chooseReceipt = async camera => {
    const options = { mediaTypes: ["images"], quality: .7, base64: true };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const asset = result.assets[0]; setImage(asset.uri); setBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/scan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}` }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || "Scan failed");
      loadReceipt(data);
    } catch (error) { Alert.alert("Unable to read receipt", error.message); }
    finally { setBusy(false); }
  };

  const totals = useMemo(() => {
    const owed = Object.fromEntries(people.map(p => [p.id, 0]));
    items.forEach(item => {
      const owners = item.shared ? people.map(p => p.id) : item.owners;
      if (!owners.length) return;
      owners.forEach(id => owed[id] += item.price * item.quantity / owners.length);
    });
    const subtotal = items.reduce((sum, x) => sum + x.price * x.quantity, 0);
    const assigned = Object.values(owed).reduce((a, b) => a + b, 0);
    const adjustment = fees.serviceCharge + fees.tax - fees.discount;
    people.forEach(p => owed[p.id] = Math.round((owed[p.id] + adjustment * (assigned ? owed[p.id] / assigned : 1 / people.length)) * 100) / 100);
    return { owed, subtotal, total: subtotal + adjustment };
  }, [items, people, fees]);

  const updateItem = (id, key, value) => setItems(current => current.map(x => x.id === id ? { ...x, [key]: value } : x));
  const assign = (itemId, personId) => setItems(current => current.map(x => x.id !== itemId ? x : { ...x, shared: false, owners: x.owners.includes(personId) ? x.owners.filter(id => id !== personId) : [...x.owners, personId] }));
  const nextAssignment = () => {
    if (!people.length) return Alert.alert("Add someone", "Enter at least one person's name.");
    return items.some(x => !x.shared && !x.owners.length) ? Alert.alert("Missing assignments", "Assign every item before continuing.") : setStep(3);
  };

  if (!welcomed) return <SafeAreaView style={styles.safe}><StatusBar style="dark"/><View style={styles.welcome}>
    <View style={styles.logoCrop}><Image source={require("./assets/logo-nude.png")} style={styles.logoImage}/></View>
    <Text style={styles.welcomeBrand}>Split<Text style={styles.brandAccent}>Up</Text>Fair</Text>
    <Text style={styles.welcomeTitle}>Split the bill.{"\n"}Keep the friendship.</Text>
    <Text style={styles.welcomeCopy}>Scan the receipt, assign what everyone ordered, and settle the exact amount—without awkward calculator duty.</Text>
    <View style={styles.welcomeActions}><Button onPress={() => setWelcomed(true)}>Get started  →</Button><Text style={styles.privateNote}>🔒 Receipts are processed securely and never shared.</Text></View>
  </View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><StatusBar style="dark"/><View style={styles.header}><Pressable onPress={() => step && setStep(step - 1)}><Text style={styles.back}>{step ? "‹" : "☰"}</Text></Pressable><Text style={styles.brand}>Split <Text style={styles.brandAccent}>Up</Text> Fair</Text><Text style={styles.step}>{step + 1}/4</Text></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {step === 0 && <><Text style={styles.kicker}>NO CALCULATOR. NO DRAMA.</Text><Text style={styles.hero}>Split dinner,{"\n"}not friendships.</Text><Text style={styles.copy}>Snap the receipt. We’ll handle the items, fees, and awkward math.</Text>
        <View style={styles.scanner}>{image ? <Image source={{ uri: image }} style={styles.preview}/> : <><Text style={styles.receipt}>RECEIPT</Text><Text style={styles.scanHint}>Ready for your bill</Text></>}{busy && <View style={styles.loading}><ActivityIndicator size="large" color="#d9aaa0"/><Text style={styles.loadingText}>Reading your receipt…</Text></View>}</View>
        <Button onPress={() => chooseReceipt(true)} disabled={busy}>📷  Take a photo</Button><Button onPress={() => chooseReceipt(false)} secondary disabled={busy}>Choose from gallery</Button><Pressable onPress={() => loadReceipt(demo)}><Text style={styles.demo}>Try sample receipt</Text></Pressable></>}

      {step === 1 && <><Text style={styles.kicker}>REVIEW THE SCAN</Text><Text style={styles.title}>Looks right?</Text><Text style={styles.label}>RESTAURANT</Text><TextInput style={styles.input} value={restaurant} onChangeText={setRestaurant}/>
        <View style={styles.itemLabels}><Text style={[styles.mini, { flex: 1 }]}>ITEM</Text><Text style={styles.qtyLabel}>QTY</Text><Text style={styles.priceLabel}>UNIT PRICE</Text><Text style={styles.totalLabel}>TOTAL</Text><Text style={{ width: 26 }}/></View>
        {items.map(item => <View key={item.id} style={styles.itemEdit}><TextInput style={[styles.input, { flex: 1 }]} value={item.name} onChangeText={v => updateItem(item.id, "name", v)}/><TextInput style={[styles.input, styles.quantity]} keyboardType="number-pad" value={String(item.quantity)} onChangeText={v => updateItem(item.id, "quantity", Math.max(1, Number(v) || 1))}/><TextInput style={[styles.input, styles.number]} keyboardType="decimal-pad" value={String(item.price)} onChangeText={v => updateItem(item.id, "price", Number(v) || 0)}/><View style={styles.lineTotal}><Text style={styles.lineTotalText}>{Number(item.price * item.quantity || 0).toFixed(2)}</Text></View><Pressable onPress={() => setItems(x => x.filter(i => i.id !== item.id))}><Text style={styles.remove}>×</Text></Pressable></View>)}
        <Button secondary onPress={() => setItems(x => [...x, { id: uid(), name: "New item", price: 0, quantity: 1, owners: [], shared: false }])}>＋ Add item</Button>
        <View style={styles.feeRow}>{Object.keys(fees).map(key => <View key={key} style={styles.fee}><Text style={styles.mini}>{key.replace("serviceCharge", "service")}</Text><TextInput style={styles.input} keyboardType="decimal-pad" value={String(fees[key])} onChangeText={v => setFees({ ...fees, [key]: Number(v) || 0 })}/></View>)}</View><Button onPress={() => setStep(2)}>Looks good →</Button></>}

      {step === 2 && <><Text style={styles.kicker}>TAP NAMES UNDER EACH ITEM</Text><Text style={styles.title}>Who ordered what?</Text><View style={styles.addRow}><TextInput placeholder="Add a person" style={[styles.input, { flex: 1 }]} value={newName} onChangeText={setNewName}/><Pressable style={styles.add} onPress={() => { if (newName.trim()) { setPeople(x => [...x, { id: uid(), name: newName.trim(), color: colors[x.length % colors.length], paid: false }]); setNewName(""); } }}><Text style={styles.addText}>＋</Text></Pressable></View>
        {items.map(item => <View key={item.id} style={styles.card}><View style={styles.itemTop}><View><Text style={styles.itemName}>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</Text><Text style={styles.muted}>{peso(item.price)} each · {peso(item.price * item.quantity)} total</Text></View><Pressable onPress={() => updateItem(item.id, "shared", !item.shared)} style={[styles.share, item.shared && styles.active]}><Text>Share all</Text></Pressable></View><View style={styles.chips}>{people.map(p => <Pressable key={p.id} onPress={() => assign(item.id, p.id)} style={[styles.chip, item.owners.includes(p.id) && { backgroundColor: p.color }]}><Text style={styles.chipText}>{p.name}</Text></Pressable>)}</View></View>)}<Button onPress={nextAssignment}>See breakdown →</Button></>}

      {step === 3 && <><Text style={styles.kicker}>TRANSPARENT AND EXACT</Text><Text style={styles.title}>Split breakdown</Text><View style={styles.totalCard}><Text style={styles.muted}>Receipt total</Text><Text style={styles.total}>{peso(totals.total)}</Text></View>{people.map(p => <Pressable key={p.id} style={[styles.person, p.paid && styles.paid]} onPress={() => setPeople(x => x.map(y => y.id === p.id ? { ...y, paid: !y.paid } : y))}><View style={[styles.avatar, { backgroundColor: p.color }]}><Text style={styles.avatarText}>{p.name[0]}</Text></View><Text style={styles.personName}>{p.name}</Text><View><Text style={styles.amount}>{peso(totals.owed[p.id])}</Text><Text style={styles.mark}>{p.paid ? "✓ Paid" : "Mark paid"}</Text></View></Pressable>)}<Button onPress={() => Share.share({ message: `${restaurant}\n${people.map(p => `${p.name}: ${peso(totals.owed[p.id])}`).join("\n")}\nTotal: ${peso(totals.total)}` })}>Share breakdown</Button><Button secondary onPress={() => { setStep(0); setImage(null); setItems([]); }}>Start new split</Button></>}
    </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:"#f6eee8",paddingTop:Platform.OS === "android" ? NativeStatusBar.currentHeight || 24 : 0},welcome:{flex:1,padding:28,alignItems:"center",paddingTop:55},logoCrop:{width:168,height:168,borderRadius:84,overflow:"hidden",backgroundColor:"#e8d8cd",borderWidth:1,borderColor:"#d8c1b5"},logoImage:{width:168,height:168},welcomeBrand:{fontSize:27,fontWeight:"900",marginTop:20,color:"#3b2d28"},welcomeTitle:{fontSize:39,lineHeight:43,fontWeight:"900",textAlign:"center",marginTop:30,color:"#3b2d28"},welcomeCopy:{fontSize:16,lineHeight:24,color:"#78665d",textAlign:"center",marginTop:18,maxWidth:340},welcomeActions:{width:"100%",marginTop:"auto",paddingBottom:24},privateNote:{fontSize:11,color:"#927c70",textAlign:"center",marginTop:14},header:{height:62,paddingHorizontal:20,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderColor:"#dfcec4"},back:{fontSize:31,width:40,color:"#3b2d28"},brand:{fontSize:21,fontWeight:"900",color:"#3b2d28"},brandAccent:{color:"#b8755f"},step:{fontSize:12,fontWeight:"800",color:"#927c70"},content:{padding:22,paddingBottom:60},kicker:{fontSize:12,fontWeight:"800",color:"#a26755",letterSpacing:1,marginTop:12},hero:{fontSize:46,lineHeight:48,fontWeight:"900",marginTop:12,color:"#3b2d28"},title:{fontSize:34,fontWeight:"900",marginVertical:10,color:"#3b2d28"},copy:{fontSize:17,lineHeight:25,color:"#78665d",marginVertical:14},scanner:{height:290,borderRadius:27,backgroundColor:"#3b2d28",marginVertical:18,alignItems:"center",justifyContent:"center",overflow:"hidden",borderWidth:2,borderColor:"#b8755f"},receipt:{backgroundColor:"#fffaf5",padding:45,fontWeight:"900",transform:[{rotate:"-3deg"}]},scanHint:{color:"#d9c9c0",marginTop:20},preview:{width:"100%",height:"100%",resizeMode:"contain"},loading:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(59,45,40,.88)",alignItems:"center",justifyContent:"center"},loadingText:{color:"white",marginTop:14,fontWeight:"700"},button:{backgroundColor:"#b8755f",borderRadius:16,padding:16,alignItems:"center",marginTop:10},buttonText:{fontSize:16,fontWeight:"900",color:"#fffaf5"},secondary:{backgroundColor:"transparent",borderWidth:1,borderColor:"#d8c1b5"},secondaryText:{color:"#3b2d28"},disabled:{opacity:.5},demo:{textAlign:"center",marginTop:20,textDecorationLine:"underline",fontWeight:"700",color:"#8f5948"},label:{fontSize:11,fontWeight:"800",color:"#927c70",marginTop:10},input:{backgroundColor:"#fffaf5",borderWidth:1,borderColor:"#dfcec4",borderRadius:12,padding:10,fontSize:14,color:"#3b2d28"},itemLabels:{flexDirection:"row",gap:5,alignItems:"center",marginTop:18},qtyLabel:{width:42,fontSize:9,color:"#927c70"},priceLabel:{width:67,fontSize:9,color:"#927c70"},totalLabel:{width:68,fontSize:9,color:"#927c70"},itemEdit:{flexDirection:"row",gap:5,alignItems:"center",marginTop:9},quantity:{width:42,textAlign:"center"},number:{width:67},lineTotal:{width:68,minHeight:42,borderRadius:12,backgroundColor:"#eaded7",alignItems:"flex-end",justifyContent:"center",paddingHorizontal:7},lineTotalText:{fontSize:12,fontWeight:"800",color:"#3b2d28"},remove:{fontSize:27,color:"#a9554c",padding:3},feeRow:{flexDirection:"row",gap:7,marginVertical:16},fee:{flex:1},mini:{fontSize:10,color:"#927c70",textTransform:"uppercase",marginBottom:4},addRow:{flexDirection:"row",gap:8,marginBottom:16},add:{width:48,borderRadius:14,backgroundColor:"#3b2d28",alignItems:"center",justifyContent:"center"},addText:{color:"white",fontSize:24},card:{backgroundColor:"#fffaf5",borderWidth:1,borderColor:"#dfcec4",borderRadius:18,padding:15,marginBottom:10},itemTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},itemName:{fontSize:16,fontWeight:"800",color:"#3b2d28"},muted:{color:"#927c70",marginTop:3},share:{backgroundColor:"#eaded7",padding:9,borderRadius:10},active:{backgroundColor:"#d9aaa0"},chips:{flexDirection:"row",flexWrap:"wrap",gap:7,marginTop:13},chip:{borderWidth:1,borderColor:"#dfcec4",borderRadius:30,paddingVertical:8,paddingHorizontal:12},chipText:{fontWeight:"700",color:"#3b2d28"},totalCard:{backgroundColor:"#ead8cf",borderRadius:22,padding:25,alignItems:"center",marginVertical:15},total:{fontSize:39,fontWeight:"900",marginTop:4,color:"#3b2d28"},person:{flexDirection:"row",alignItems:"center",backgroundColor:"#fffaf5",padding:13,borderRadius:16,marginBottom:9},paid:{opacity:.5},avatar:{width:43,height:43,borderRadius:22,alignItems:"center",justifyContent:"center"},avatarText:{fontWeight:"900",color:"#3b2d28"},personName:{fontWeight:"800",fontSize:16,flex:1,marginLeft:11,color:"#3b2d28"},amount:{fontWeight:"900",textAlign:"right",color:"#3b2d28"},mark:{fontSize:11,color:"#a26755",textAlign:"right",marginTop:3,fontWeight:"700"}
});
